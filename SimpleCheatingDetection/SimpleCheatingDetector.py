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


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_2_PATH = os.path.join(BASE_DIR, "models", "modelv8-2.pt")
EYE_MODEL_PATH = os.path.join(BASE_DIR, "models", "eye_modelv3.h5")
FACE_LANDMARKER_PATH = os.path.join(BASE_DIR, "models", "face_landmarker.task")
IMG_SIZE = (56, 64)
CLASS_LABELS = ['center', 'left', 'right']


class SimpleCheatingDetector:
    def __init__(self, eye_closure_threshold=0.009, closed_eye_cheat_time=4.0, skip_frames=6):
        self.eye_closure_threshold = eye_closure_threshold
        self.closed_eye_cheat_time = closed_eye_cheat_time
        self.skip_frames = skip_frames
        self.device = 0 if torch.cuda.is_available() else 'cpu'

        gpus = tf.config.list_physical_devices('GPU')
        if gpus:
            for gpu in gpus:
                tf.config.experimental.set_memory_growth(gpu, True)

        self.yolo_model = YOLO(MODEL_2_PATH)
        self.eye_model = load_model(EYE_MODEL_PATH)
        self.face_landmarker = self._init_mediapipe()

        self.last_direction = "center"
        self.direction_start_time = 0

        self.cheating_frame_list_head_tilt = []
        self.cheating_detected_head_tilt = False

        self.cheating_frame_list_eye_tilt = []
        self.cheating_detected_eye_tilt = False

        self.cheating_frame_list_gaze = []
        self.gaze_frames = []

        self.closed_eye_start_time = None
        self.closed_eye_frames = []

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
        self.fps = 0

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
        h, w = gray_frame.shape

        if indices == [33, 133, 159, 145]:
            upper_idx, lower_idx = 159, 145
        else:
            upper_idx, lower_idx = 386, 374

        eye_height = abs(landmarks[upper_idx].y - landmarks[lower_idx].y)

        eye_points_pixel = np.array(
            [[int(landmarks[i].x * w), int(landmarks[i].y * h)] for i in indices],
            dtype=np.int64
        )

        x1, y1 = np.min(eye_points_pixel, axis=0)
        x2, y2 = np.max(eye_points_pixel, axis=0)

        x1, y1 = max(0, x1), max(0, y1)
        x2, y2 = min(w, x2), min(h, y2)

        bbox = (x1, y1, x2, y2)

        if eye_height < self.eye_closure_threshold:
            return None, "closed", bbox

        eye_img = gray_frame[y1:y2, x1:x2]

        if eye_img.size == 0:
            return None, "closed", bbox

        return eye_img, "open", bbox

    def process_video(self, input_path):
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

        last_left_dir = "center"
        last_right_dir = "center"

        start_process_time = time.time()

        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break

            frame_count += 1
            current_video_time = frame_count / fps
            self.video_duration = current_video_time

            if frame_count % self.skip_frames == 0:
                results = self.yolo_model(frame, verbose=False, device=self.device)[0]
                has_head_tilt = False
                self.last_face_box = None

                for box in results.boxes:
                    cls = int(box.cls[0])
                    class_name = self.yolo_model.names[cls]
                    x1, y1, x2, y2 = map(int, box.xyxy[0])
                    self.last_face_box = (x1, y1, x2, y2, class_name)
                    if class_name == "cheating":
                        has_head_tilt = True
                        break

                if has_head_tilt:
                    self.cheating_detected_head_tilt = True
                    head_tilt_ls.append(frame_count)
                else:
                    if self.cheating_detected_head_tilt and head_tilt_ls:
                        duration = (max(head_tilt_ls) - min(head_tilt_ls)) / fps
                        if duration >= self.closed_eye_cheat_time:
                            self.cheating_frame_list_head_tilt.append(
                                (min(head_tilt_ls), max(head_tilt_ls))
                            )
                        head_tilt_ls = []
                        self.cheating_detected_head_tilt = False

                rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)
                frame_timestamp_ms = int((frame_count * 1000) / fps)
                detection = self.face_landmarker.detect_for_video(
                    mp_image, frame_timestamp_ms
                )

                left_dir = last_left_dir
                right_dir = last_right_dir

                if not detection.face_landmarks:
                    self.last_left_eye_box = None
                    self.last_right_eye_box = None

                if detection.face_landmarks:
                    landmarks = detection.face_landmarks[0]
                    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
                    eyes_to_process = []
                    eye_indices_map = []

                    l_img, l_status, l_bbox = self._get_eye_image(gray, landmarks, [33, 133, 159, 145])
                    self.last_left_eye_box = l_bbox
                    if l_status == "closed":
                        left_dir = "closed"
                    else:
                        eyes_to_process.append(l_img)
                        eye_indices_map.append(0)

                    r_img, r_status, r_bbox = self._get_eye_image(gray, landmarks, [362, 263, 386, 374])
                    self.last_right_eye_box = r_bbox
                    if r_status == "closed":
                        right_dir = "closed"
                    else:
                        eyes_to_process.append(r_img)
                        eye_indices_map.append(1)

                    if eyes_to_process:
                        batch = []
                        for img in eyes_to_process:
                            processed = cv2.resize(img, (IMG_SIZE[1], IMG_SIZE[0]))
                            processed = processed / 255.0
                            batch.append(processed)

                        batch_np = np.array(batch, dtype=np.float32)
                        batch_np = batch_np.reshape((len(batch), *IMG_SIZE, 1))
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

                if left_dir == "closed" and right_dir == "closed":
                    if self.closed_eye_start_time is None:
                        self.closed_eye_start_time = current_video_time
                        self.closed_eye_frames = [frame_count]
                    else:
                        self.closed_eye_frames.append(frame_count)

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

                is_looking_away = (left_dir in ["left", "right"]) or (right_dir in ["left", "right"])

                if is_looking_away:
                    self.gaze_frames.append(frame_count)
                else:
                    if self.gaze_frames:
                        duration = (max(self.gaze_frames) - min(self.gaze_frames)) / fps
                        if duration >= self.closed_eye_cheat_time:
                            self.cheating_frame_list_gaze.append(
                                (min(self.gaze_frames), max(self.gaze_frames))
                            )
                        self.gaze_frames = []

            out.write(frame)

        if self.cheating_detected_head_tilt and head_tilt_ls:
            duration = (max(head_tilt_ls) - min(head_tilt_ls)) / fps
            if duration >= self.closed_eye_cheat_time:
                self.cheating_frame_list_head_tilt.append(
                    (min(head_tilt_ls), max(head_tilt_ls))
                )

        if self.cheating_detected_eye_tilt and self.closed_eye_frames:
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

        return output_path

    def get_cheating_intervals(self):
        intervals = []
        if self.fps == 0:
            return intervals

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


def main():
    detector = SimpleCheatingDetector()
    output_path = detector.process_video("sampled_videos/input_video.mp4")
    print("Processed video saved at:", output_path)
    print("Merged Cheating Intervals:", detector.get_cheating_intervals())


if __name__ == "__main__":
    main()
