from moviepy.video.io.VideoFileClip import VideoFileClip
from pydub import AudioSegment
import os
import uuid

class Audio:
    def extract_audio(self, video_path: str):
        try:
            video = VideoFileClip(video_path)
            
            audio = video.audio
            
            random_id = str(uuid.uuid4())

            audio_output_path = f"extracted_audio/{random_id}_audio.mp3"
            
            os.makedirs(os.path.dirname(audio_output_path), exist_ok=True)
            
            audio.write_audiofile(audio_output_path)
            
            video.close()
            audio.close()
            print(f"Audio extracted and saved to {audio_output_path}")
            
            return audio_output_path
        
        except Exception as e:
            print(f"Error extracting audio: {e}")
    
    def overlay_audio(self, audio1_path: str, audio2_path: str):
        try:
            audio1 = AudioSegment.from_file(audio1_path)
            audio2 = AudioSegment.from_file(audio2_path)
            
            combined = audio1.overlay(audio2)
            
            random_id = str(uuid.uuid4())
            output_audio_path = f"final_audio/{random_id}_audio.mp3"
            
            os.makedirs(os.path.dirname(output_audio_path), exist_ok=True)
            
            combined.export(output_audio_path, format="mp3")
            
            print(f"Overlayed audio saved to {output_audio_path}")
            
            return output_audio_path
        
        except Exception as e:
            print(f"Error overlaying audio: {e}")
    
if __name__ == "__main__":
    audio_processor = Audio()
    audio1_path = audio_processor.extract_audio("sampled_videos/recording_local_1769263329508.mp4")
    audio2_path = audio_processor.extract_audio("sampled_videos/recording_4811f3a0_e960_4dc7_9e15_9c30ffbd9418_1769263329524.mp4")
    combined_audio_path = audio_processor.overlay_audio(audio1_path, audio2_path)