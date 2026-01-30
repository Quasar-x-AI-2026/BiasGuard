import cv2
import numpy as np
import os
import time
from ultralytics import YOLO
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision
from tensorflow.keras.models import load_model
from MergeIntervals import MergeIntervals
import uuid
import torch
import tensorflow as tf


# Constants
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_2_PATH = os.path.join(BASE_DIR, "models", "modelv8-2.pt")
EYE_MODEL_PATH = os.path.join(BASE_DIR, "models", "eye_modelv3.h5")
FACE_LANDMARKER_PATH = os.path.join(BASE_DIR, "models", "face_landmarker.task")
IMG_SIZE = (56, 64)
CLASS_LABELS = ['center', 'left', 'right']

class SimpleCheatingDetector:
    def __init__(self, eye_closure_threshold=0.009, closed_eye_cheat_time=4.0, skip_frames=6):
        print("Initializing models...")
        
        self.eye_closure_threshold = eye_closure_threshold
        self.closed_eye_cheat_time = closed_eye_cheat_time
        self.skip_frames = skip_frames
        
        # Check for GPU availability for YOLO
        self.device = 0 if torch.cuda.is_available() else 'cpu'
        print(f"YOLO using device: {self.device}")

        # Check for GPU availability for TensorFlow
        gpus = tf.config.list_physical_devices('GPU')
        if gpus:
            try:
                for gpu in gpus:
                    tf.config.experimental.set_memory_growth(gpu, True)
                print(f"TensorFlow using GPU: {len(gpus)} device(s)")
            except RuntimeError as e:
                print(f"TensorFlow GPU Error: {e}")
        else:
            print("TensorFlow using CPU")

        self.yolo_model = YOLO(MODEL_2_PATH)
        self.eye_model = load_model(EYE_MODEL_PATH)
        self.face_landmarker = self._init_mediapipe()

        self.last_direction = "center"
        self.direction_start_time = 0  # Changed to video timestamp

        self.cheating_frame_list_head_tilt = []
        self.cheating_detected_head_tilt = False

        self.cheating_frame_list_eye_tilt = []
        self.cheating_detected_eye_tilt = False

        # Gaze tracking (Left/Right)
        self.cheating_frame_list_gaze = []
        self.gaze_frames = []

        # Closed-eye tracking
        self.closed_eye_start_time = None
        self.closed_eye_frames = []
        
        # Visualization state
        self.last_face_box = None
        self.last_left_eye_box = None
        self.last_right_eye_box = None

        self.colors = {
            "cheating": (0, 0, 255),
            "normal": (0, 255, 0),
            "warning": (0, 165, 255),
            "closed": (128, 128, 128)
        }

        self.video_duration = 0
        self.fps = 0 # Initialize fps

    def _init_mediapipe(self):
        base_options = python.BaseOptions(model_asset_path=FACE_LANDMARKER_PATH)
        options = vision.FaceLandmarkerOptions(
            base_options=base_options,
            running_mode=vision.RunningMode.VIDEO,
            num_faces=1,
            min_face_detection_confidence=0.5,
            min_tracking_confidence=0.5
        )
        return vision.FaceLandmarker.create_from_options(options)

    def _get_eye_image(self, gray_frame, landmarks, indices):
        """Extracts eye image and checks closure. Returns (image, status, bbox)."""
        h, w = gray_frame.shape

        if indices == [33, 133, 159, 145]: # Left eye indices
            upper_idx, lower_idx = 159, 145
        else: # Right eye indices
            upper_idx, lower_idx = 386, 374

        eye_height = abs(landmarks[upper_idx].y - landmarks[lower_idx].y)
        
        eye_points_pixel = np.array(
            [[int(landmarks[i].x * w), int(landmarks[i].y * h)] for i in indices],
            dtype=np.int64
        )

        x1, y1 = np.min(eye_points_pixel, axis=0)
        x2, y2 = np.max(eye_points_pixel, axis=0)
        
        # Add padding check or clamp
        x1, y1 = max(0, x1), max(0, y1)
        x2, y2 = min(w, x2), min(h, y2)
        
        bbox = (x1, y1, x2, y2)

        if eye_height < self.eye_closure_threshold:
            return None, "closed", bbox

        eye_img = gray_frame[y1:y2, x1:x2]

        if eye_img.size == 0:
            return None, "closed", bbox
            
        return eye_img, "open", bbox

    def process_video(self, input_path: str):
        random_id = str(uuid.uuid4())
        output_path = f"extracted_videos/{random_id}_processed_video.mp4"
        
        
        cap = cv2.VideoCapture(input_path)
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        self.fps = int(cap.get(cv2.CAP_PROP_FPS))
        fps = self.fps
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

        out = cv2.VideoWriter(
            output_path,
            cv2.VideoWriter_fourcc(*'mp4v'),
            fps,
            (width, height)
        )

        frame_count = 0
        head_tilt_ls = []
        
        # State persistence for frames skipped
        last_left_dir = "center"
        last_right_dir = "center"
        
        print(f"Processing video: {total_frames} frames @ {fps} fps")
        start_process_time = time.time()

        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break

            frame_count += 1
            current_video_time = frame_count / fps
            self.video_duration = current_video_time

            # ---------------- FRAME SKIPPING ----------------
            should_process = (frame_count % self.skip_frames == 0)

            # Only run heavy models if it's a processing frame
            if should_process:
                # ---------------- YOLO HEAD TILT ----------------
                results = self.yolo_model(frame, verbose=False, device=self.device)[0]
                has_head_tilt = False
                self.last_face_box = None # Reset if no face found this frame
                
                for box in results.boxes:
                    cls = int(box.cls[0])
                    class_name = self.yolo_model.names[cls]
                    
                    # Store box for visualization
                    x1, y1, x2, y2 = map(int, box.xyxy[0])
                    self.last_face_box = (x1, y1, x2, y2, class_name)
                    
                    if class_name == "cheating":
                        has_head_tilt = True
                        break # Prioritize cheating detection
                
                if has_head_tilt:
                    self.cheating_detected_head_tilt = True
                    head_tilt_ls.append(frame_count)
                else:
                    if self.cheating_detected_head_tilt and head_tilt_ls:
                        # Check duration
                        duration = (max(head_tilt_ls) - min(head_tilt_ls)) / fps
                        if duration >= self.closed_eye_cheat_time:
                            self.cheating_frame_list_head_tilt.append(
                                (min(head_tilt_ls), max(head_tilt_ls))
                            )
                        head_tilt_ls = []
                        self.cheating_detected_head_tilt = False

                # ---------------- EYE TRACKING ----------------
                rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)
                
                frame_timestamp_ms = int((frame_count * 1000) / fps)
                detection = self.face_landmarker.detect_for_video(
                    mp_image, frame_timestamp_ms
                )

                left_dir = last_left_dir
                right_dir = last_right_dir
                
                # Reset eye boxes if no face landmarks
                if not detection.face_landmarks:
                    self.last_left_eye_box = None
                    self.last_right_eye_box = None
                
                if detection.face_landmarks:
                    landmarks = detection.face_landmarks[0]
                    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

                    # Prepare batch for eye model
                    eyes_to_process = [] 
                    eye_indices_map = [] # 0 for left, 1 for right

                    # Left Eye
                    l_img, l_status, l_bbox = self._get_eye_image(gray, landmarks, [33, 133, 159, 145])
                    self.last_left_eye_box = l_bbox
                    
                    if l_status == "closed":
                        left_dir = "closed"
                    else:
                        eyes_to_process.append(l_img)
                        eye_indices_map.append(0)

                    # Right Eye
                    r_img, r_status, r_bbox = self._get_eye_image(gray, landmarks, [362, 263, 386, 374])
                    self.last_right_eye_box = r_bbox
                    
                    if r_status == "closed":
                        right_dir = "closed"
                    else:
                        eyes_to_process.append(r_img)
                        eye_indices_map.append(1)

                    # Batch Predict
                    if eyes_to_process:
                        batch = []
                        for img in eyes_to_process:
                            processed = cv2.resize(img, (IMG_SIZE[1], IMG_SIZE[0]))
                            processed = processed / 255.0
                            batch.append(processed)
                        
                        batch_np = np.array(batch, dtype=np.float32)
                        batch_np = batch_np.reshape((len(batch), *IMG_SIZE, 1))
                        
                        # Use call instead of predict for speed
                        preds = self.eye_model(batch_np, training=False).numpy()
                        
                        for i, list_idx in enumerate(eye_indices_map):
                            pred_idx = np.argmax(preds[i])
                            direction = CLASS_LABELS[pred_idx]
                            if list_idx == 0:
                                left_dir = direction
                            else:
                                right_dir = direction

                    last_left_dir = left_dir
                    last_right_dir = right_dir
                
                # -------- CLOSED EYE CHEATING LOGIC (Updated for video time) --------
                if left_dir == "closed" and right_dir == "closed":
                    if self.closed_eye_start_time is None:
                        self.closed_eye_start_time = current_video_time
                        self.closed_eye_frames = [frame_count]
                    else:
                        self.closed_eye_frames.append(frame_count)

                    # Check duration using VIDEO time
                    if current_video_time - self.closed_eye_start_time >= self.closed_eye_cheat_time:
                        self.cheating_detected_eye_tilt = True
                else:
                    if self.cheating_detected_eye_tilt and self.closed_eye_frames:
                        self.cheating_frame_list_eye_tilt.append(
                            (min(self.closed_eye_frames), max(self.closed_eye_frames))
                        )
                    self.closed_eye_start_time = None
                    self.closed_eye_frames = []
                    self.cheating_detected_eye_tilt = False

                # -------- GAZE (LEFT/RIGHT) CHEATING LOGIC --------
                is_looking_away = (left_dir in ["left", "right"]) or (right_dir in ["left", "right"])
                
                if is_looking_away:
                    self.gaze_frames.append(frame_count)
                else:
                    if self.gaze_frames:
                        # Check duration
                        duration = (max(self.gaze_frames) - min(self.gaze_frames)) / fps
                        if duration >= self.closed_eye_cheat_time:
                            self.cheating_frame_list_gaze.append(
                                (min(self.gaze_frames), max(self.gaze_frames))
                            )
                        self.gaze_frames = []

            # ---------------- VISUALIZATION ----------------
            # Draw Face Box
            if self.last_face_box:
                x1, y1, x2, y2, cls_name = self.last_face_box
                color = self.colors.get(cls_name, self.colors["normal"])
                cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
                cv2.putText(frame, cls_name, (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.9, color, 2)

            # Draw Eye Boxes and Status
            for bbox, status, label in [(self.last_left_eye_box, last_left_dir, "L"), (self.last_right_eye_box, last_right_dir, "R")]:
                if bbox:
                    ex1, ey1, ex2, ey2 = bbox
                    color = self.colors["closed"] if status == "closed" else self.colors["normal"]
                    if status != "center" and status != "closed":
                         color = self.colors["warning"]
                    
                    cv2.rectangle(frame, (ex1, ey1), (ex2, ey2), color, 1)
                    # Show direction text near eye
                    cv2.putText(frame, f"{label}:{status}", (ex1, ey1 - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.4, color, 1)

            # Update progress
            if frame_count % 30 == 0:
                elapsed = time.time() - start_process_time
                fps_proc = frame_count / (elapsed + 1e-9)
                print(f"Frame {frame_count}/{total_frames} | Speed: {fps_proc:.2f} fps", end='\r')

            out.write(frame)

        # FLUSH REMAINING INTERVALS
        if self.cheating_detected_head_tilt and head_tilt_ls:
            duration = (max(head_tilt_ls) - min(head_tilt_ls)) / fps
            if duration >= self.closed_eye_cheat_time:
                self.cheating_frame_list_head_tilt.append(
                    (min(head_tilt_ls), max(head_tilt_ls))
                )

        if self.cheating_detected_eye_tilt and self.closed_eye_frames:
             # Already handled by real-time logic mostly, but good to be safe.
             # However, the logic for closed eyes is "if duration >= threshold then detected=True"
             # So if we are here and detected=True, we might need to push.
             # But the list might have started before and not finished? 
             # Let's keep consistent logic:
             duration = (max(self.closed_eye_frames) - min(self.closed_eye_frames)) / fps
             if duration >= self.closed_eye_cheat_time:
                 self.cheating_frame_list_eye_tilt.append(
                    (min(self.closed_eye_frames), max(self.closed_eye_frames))
                )

        if self.gaze_frames:
             duration = (max(self.gaze_frames) - min(self.gaze_frames)) / fps
             if duration >= self.closed_eye_cheat_time:
                 self.cheating_frame_list_gaze.append(
                    (min(self.gaze_frames), max(self.gaze_frames))
                )

        cap.release()
        out.release()
        total_time = time.time() - start_process_time
        print(f"\nProcessed {frame_count} frames in {total_time:.2f}s ({frame_count/total_time:.2f} fps)")
        
        return output_path

    def get_cheating_intervals(self):
        intervals = []
        if self.fps == 0:
            return intervals

        # Include gaze intervals in the merge
        all_intervals = (
            self.cheating_frame_list_head_tilt + 
            self.cheating_frame_list_eye_tilt + 
            self.cheating_frame_list_gaze
        )

        for start, end in all_intervals:
            if start != end:
                intervals.append((
                    max(0, start / self.fps - 10),
                    min(self.video_duration, end / self.fps + 10)
                ))

        return MergeIntervals().merge(intervals)

if __name__ == "__main__":
    detector = SimpleCheatingDetector()
    detector.process_video("sampled_videos/input_video.mp4", "result_videos/output_video.mp4")
    print("Merged Cheating Intervals:", detector.get_cheating_intervals())
