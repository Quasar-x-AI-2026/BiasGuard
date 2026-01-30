from SimpleCheatingDetector import SimpleCheatingDetector
from moviepy.video.io.VideoFileClip import VideoFileClip
from moviepy.audio.io.AudioFileClip import AudioFileClip
from moviepy.video.compositing.CompositeVideoClip import concatenate_videoclips
import os
import time
from typing import List
import uuid
from moviepy import clips_array


start_time = time.time()


class Video:
    def __init__(self):
        pass

    def edit_video(
        self,
        process_video_input: str="sampled_videos/input_video.mp4",
        final_output_path: str="edited_videos/output.mp4",
        cuts: List[tuple]=[(10, 20), (30, 40)]
    ):
        print("Cheating Intervals (in seconds):", cuts)

        if not cuts:
            print("No cheating intervals detected — nothing to export.")
            return

        try:
            video = VideoFileClip(process_video_input)
            duration = video.duration
            EPS = 0.001

            clips = []
            for start, end in cuts:
                start = max(0, start)
                end = min(duration - EPS, end)

                if end > start:
                    clips.append(video.subclipped(start, end))

            if not clips:
                print("All detected clips were invalid after trimming.")
                video.close()
                return

            # method="chain" is generally safer for audio and faster for simple cuts
            final_clip = concatenate_videoclips(clips, method="chain")

            os.makedirs(os.path.dirname(final_output_path), exist_ok=True)

            final_clip.write_videofile(
                final_output_path,
                codec="libx264",
                audio_codec="aac",
                fps=video.fps
            )
            
            final_clip.close()
            for clip in clips:
                clip.close()
            video.close()
            
            return final_output_path

        except Exception as e:
            print(f"Error during video editing: {e}")
            if 'video' in locals(): video.close()
            if 'final_clip' in locals(): final_clip.close()
            return None
            
    def mute_audio(self, video_path: str):
        clip = VideoFileClip(video_path)
        video_no_audio = clip.without_audio()
        
        random_id = str(uuid.uuid4())
        output_path = f"extracted_videos/{random_id}_muted_video.mp4"
        
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        
        
        
        video_no_audio.write_videofile(
            output_path,
            codec="libx264",
            audio=False
        )
        
        clip.close()
        video_no_audio.close()
        
        return output_path
    
    def overlay_video_audio(self, video_path: str, audio_path: str):
        video = VideoFileClip(video_path)
        audio = AudioFileClip(audio_path)
        
        final = video.with_audio(audio)
        
        random_id = str(uuid.uuid4())
        output_path = f"extracted_videos/{random_id}_final_video.mp4"
        
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        
        final.write_videofile(
            output_path,
            codec="libx264",
            audio_codec="aac"
        )
        
        video.close()
        audio.close()
        final.close()
        
        return output_path

    def clip_array(self, video1_path: str, video2_path: str):
        clip1 = VideoFileClip(video1_path)
        clip2 = VideoFileClip(video2_path)
        
        final = clips_array([[clip1, clip2]])
        
        random_id = str(uuid.uuid4())
        output_path = f"final_videos/{random_id}_final_video.mp4"
        
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        
        final.write_videofile(
            output_path,
            codec="libx264",
            audio_codec="aac"
        )
        
        clip1.close()
        clip2.close()
        final.close()
        
        return output_path