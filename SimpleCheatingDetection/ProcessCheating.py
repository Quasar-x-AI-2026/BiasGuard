from ExtractAudio import Audio
from EditVideo import Video
from SimpleCheatingDetector import SimpleCheatingDetector
import os
import time
from OpenAI_Rating import InterviewRater


def remove_non_empty_dir(path):
    if not os.path.exists(path):
        return
    for root, dirs, files in os.walk(path, topdown=False):
        for file in files:
            os.remove(os.path.join(root, file))
        for dir in dirs:
            os.rmdir(os.path.join(root, dir))
    os.rmdir(path)



class ProcessCheating:
    def __init__(self, 
    teacher_audio_video_path = "sampled_videos/recording_local_1769263329508.mp4", 
    student_audio_video_path = "sampled_videos/recording_local_1769263329508.mp4", 
    student_audio_video_path_second_pov = "sampled_videos/recording_7aee6f2a_9dcc_4e90_8f27_c4601e9aa73a_1769263329509.mp4",
    eye_closure_threshold=0.009,
    closed_eye_cheat_time=4.0,
    skip_frames=6):
        self.teacher_audio_video_path = teacher_audio_video_path
        self.student_audio_video_path = student_audio_video_path
        self.student_audio_video_path_second_pov = student_audio_video_path_second_pov
        self.eye_closure_threshold = eye_closure_threshold
        self.closed_eye_cheat_time = closed_eye_cheat_time
        self.skip_frames = skip_frames
        
    def run(self, status_callback=None):
        def notify(msg):
            if status_callback:
                status_callback(msg)
            print(msg)

        start = time.time()
        
        notify("Cleaning up previous runs...")
        remove_non_empty_dir("final_videos")
        
        notify("Extracting teacher audio...")
        teacher_audio_path = Audio().extract_audio(self.teacher_audio_video_path)
        
        notify("Extracting student audio...")
        student_audio_path = Audio().extract_audio(self.student_audio_video_path)
        
        notify("Overlaying combined audio...")
        combined_audio_path = Audio().overlay_audio(teacher_audio_path, student_audio_path)

        rater = InterviewRater()
        results = rater.rate_interview(combined_audio_path, "Software Engineer")
        notify(results)
        
        notify("Muting videos for processing...")
        teacher_video_path = Video().mute_audio(self.teacher_audio_video_path)
        student_video_path = Video().mute_audio(self.student_audio_video_path)
        student_video_path_second_pov = Video().mute_audio(self.student_audio_video_path_second_pov)
        
        
        notify("Initializing Detection Models...")
        detector = SimpleCheatingDetector(
            eye_closure_threshold=self.eye_closure_threshold, 
            closed_eye_cheat_time=self.closed_eye_cheat_time, 
            skip_frames=self.skip_frames
        )
        
        notify("Detecting cheating intervals (This may take some time)...")
        detected_student_video_path = detector.process_video(student_video_path)
        detected_student_video_path_cuts = detector.get_cheating_intervals()

        print("Cheating Intervals (in seconds):", detected_student_video_path_cuts)
        notify(f"Cheating detected in intervals: {detected_student_video_path_cuts}")
        
        notify("Overlaying audio back onto student video...")
        detected_student_audio_video_combined_path = Video().overlay_video_audio(detected_student_video_path, combined_audio_path)
        
        notify("Editing final videos (cutting intervals)...")
        edited_student_audio_video_combined_path = Video().edit_video(
            process_video_input=detected_student_audio_video_combined_path,
            final_output_path="final_videos/detected_student_final_video.mp4",
            cuts=detected_student_video_path_cuts
        )
        
        notify("Editing final videos (second POV)...")
        edited_student_audio_video_combined_path_second_pov = Video().edit_video(
            process_video_input=student_video_path_second_pov,
            final_output_path="final_videos/detected_student_final_video_second_pov.mp4",
            cuts=detected_student_video_path_cuts
        )
        
        if edited_student_audio_video_combined_path and edited_student_audio_video_combined_path_second_pov:
            notify("Merging clips into final output...")
            last_video = Video().clip_array(edited_student_audio_video_combined_path, edited_student_audio_video_combined_path_second_pov)
            print(f"Final video with detected clips and combined audio saved at: {last_video}")
            notify("Processing Complete.")
        else:
            msg = "Skipping final clip array creation: One or both input videos are missing (likely due to no detected cheating intervals)."
            print(msg)
            notify(msg)

        notify("Cleaning up temporary extracted files...")
        folders = ["extracted_audio", "extracted_videos", "final_audio"]

        for folder in folders:
            remove_non_empty_dir(folder)
        
        end = time.time()
        
        total_time = end - start
        print(f"Time in seconds {total_time} sec")
        notify(f"Total time taken: {total_time:.2f} seconds")


if __name__ == "__main__":
    ProcessCheating().run()
