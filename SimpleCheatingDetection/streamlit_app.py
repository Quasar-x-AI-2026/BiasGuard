
import streamlit as st
import pandas as pd
import os
import time
from ProcessCheating import ProcessCheating

# Set page config
st.set_page_config(
    page_title="Dashboard",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom CSS for Premium Black and White Theme (Dark Mode)
st.markdown("""
<style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap');

    /* Global Styles */
    html, body, [class*="css"] {
        font-family: 'Inter', sans-serif;
    }

    .stApp {
        background-color: #000000;
        color: #ffffff;
    }
    
    /* Headings */
    h1, h2, h3, h4, h5, h6 {
        color: #ffffff !important;
        font-weight: 600;
        letter-spacing: -0.5px;
    }
    
    /* Paragraphs/Labels */
    p, label {
        color: #e0e0e0 !important;
    }
    
    /* Sidebar */
    [data-testid="stSidebar"] {
        background-color: #111111; /* Slightly lighter than pure black */
        border-right: 1px solid #333333;
    }
    
    /* Buttons */
    .stButton>button {
        background-color: #1f1f1f; /* Darker shade, not pure black */
        color: #e0e0e0;
        border-radius: 2px;
        border: 1px solid #333333;
        padding: 0.6rem 1.2rem;
        font-weight: 600;
        width: 100%;
        transition: all 0.2s ease;
    }
    .stButton>button:hover {
        background-color: #333333; /* Slightly lighter on hover */
        border-color: #555555;
        color: #ffffff;
        transform: translateY(-1px);
    }
    .stButton>button:active {
        background-color: #000000;
        transform: translateY(0);
    }
    
    /* Inputs & Selectboxes */
    .stTextInput>div>div>input, .stNumberInput>div>div>input {
        background-color: #222222;
        color: #ffffff;
        border: 1px solid #444444;
        border-radius: 2px;
    }
    .stTextInput>div>div>input:focus, .stNumberInput>div>div>input:focus {
        border-color: #ffffff;
        box-shadow: none;
    }
    
    /* File Uploader */
    [data-testid="stFileUploader"] {
        border-radius: 2px;
        border: 1px dashed #555555;
        padding: 1rem;
    }
    [data-testid="stFileUploader"] section {
        background-color: #1a1a1a;
    }
    [data-testid="stFileUploader"] small {
        color: #bbbbbb !important;
    }
    
    /* Success/Info Messages - Darken them */
    .stSuccess, .stInfo, .stWarning, .stError {
        border-radius: 2px;
        opacity: 0.9;
    }

    /* Remove default gradients/decorations */
    .css-1544g2n {
        padding-top: 2rem;
    }
    
    /* Hide Streamlit Branding but keep Sidebar Toggle */
    #MainMenu {visibility: hidden;}
    footer {visibility: hidden;}
    
    /* Ensure the sidebar toggle (in the header) is visible, but we can hide the decoration */
    header {
        background: transparent !important;
    }
    
    /* If we really want to hide the top bar decoration but keep the arrow: */
    [data-testid="stHeader"] {
        background: transparent !important;
    }

</style>
""", unsafe_allow_html=True)

st.title("Dashboard")

st.sidebar.header("Configuration")

# --- File Inputs ---
st.sidebar.subheader("Upload Videos")
teacher_video_file = st.sidebar.file_uploader("Teacher Audio/Video", type=["mp4", "mov", "avi"])
student_video_file = st.sidebar.file_uploader("Student Audio/Video", type=["mp4", "mov", "avi"])
student_video_pov_file = st.sidebar.file_uploader("Student Audio/Video (2nd POV)", type=["mp4", "mov", "avi"])

# --- Parameter Controllers ---
st.sidebar.subheader("Parameters")
# Defaults are from the original code
eye_closure_threshold = st.sidebar.number_input(
    "Eye Closure Threshold", 
    min_value=0.0, 
    max_value=1.0, 
    value=0.009, 
    format="%.4f",
    step=0.001
)

closed_eye_cheat_time = st.sidebar.number_input(
    "Closed Eye Cheat Time (seconds)", 
    min_value=0.5, 
    max_value=60.0, 
    value=4.0, 
    step=0.5
)

skip_frames = st.sidebar.number_input(
    "Skip Frames (Process every Nth frame)", 
    min_value=1, 
    max_value=30, 
    value=6, 
    step=1
)

# --- Helper to save uploaded files ---
def save_uploaded_file(uploaded_file):
    if uploaded_file is not None:
        save_dir = "temp_uploads"
        if not os.path.exists(save_dir):
            os.makedirs(save_dir)
        file_path = os.path.join(save_dir, uploaded_file.name)
        with open(file_path, "wb") as f:
            f.write(uploaded_file.getbuffer())
        return file_path
    return None

def cleanup_temp_files(file_paths):
    for path in file_paths:
        if path and os.path.exists(path):
            try:
                os.remove(path)
            except Exception as e:
                print(f"Error removing {path}: {e}")

# --- Main Processing ---
if st.button("Process Video"):
    if teacher_video_file and student_video_file and student_video_pov_file:
        t_path = None
        s_path = None
        s_pov_path = None
        
        try:
            with st.status("Processing videos...", expanded=True) as status:
                st.write("Uploading files...")
                # Save files to disk
                t_path = save_uploaded_file(teacher_video_file)
                s_path = save_uploaded_file(student_video_file)
                s_pov_path = save_uploaded_file(student_video_pov_file)
                
                results_data = {}
                def status_update(msg):
                    if isinstance(msg, list):
                        results_data['ratings'] = msg
                        st.write("Interview Rated.")
                    else:
                        st.write(msg)
                
                # Instantiate ProcessCheating
                processor = ProcessCheating(
                    teacher_audio_video_path=t_path,
                    student_audio_video_path=s_path,
                    student_audio_video_path_second_pov=s_pov_path,
                    eye_closure_threshold=eye_closure_threshold,
                    closed_eye_cheat_time=closed_eye_cheat_time,
                    skip_frames=skip_frames
                )
                
                # Run with callback
                processor.run(status_callback=status_update)
                
                status.update(label="Processing Complete!", state="complete", expanded=False)
                
            st.success("Processing Complete!")
            st.info("Check 'final_videos' folder for results if not displayed below.")

            if 'ratings' in results_data and results_data['ratings']:
                st.subheader("Interview Ratings")
                df = pd.DataFrame(results_data['ratings'])
                # Rename columns to match user request (replace underscores with spaces)
                df.columns = [col.replace('_', ' ') for col in df.columns]
                st.dataframe(df, use_container_width=True)
            
            # Try to find the latest files in final_videos
            if os.path.exists("final_videos"):
                files = sorted([f for f in os.listdir("final_videos") if f.endswith(".mp4")], 
                               key=lambda x: os.path.getmtime(os.path.join("final_videos", x)), 
                               reverse=True)
                if files:
                    st.subheader("Results")
                    cols = st.columns(2)
                    for i, f in enumerate(files):
                        with cols[i % 2]:
                            st.write(f"**{f}**")
                            file_path = os.path.join("final_videos", f)
                            st.video(file_path)
                            with open(file_path, "rb") as video_file:
                                st.download_button(
                                    label=f"Download {f}",
                                    data=video_file,
                                    file_name=f,
                                    mime="video/mp4"
                                )
                else:
                    st.warning("No output videos found in 'final_videos' folder.")
                
        except Exception as e:
            st.error(f"An error occurred: {e}")
            st.exception(e)
        finally:
            # Cleanup
            cleanup_temp_files([t_path, s_path, s_pov_path])
            os.rmdir("temp_uploads") if os.path.exists("temp_uploads") and not os.listdir("temp_uploads") else None
            
    else:
        st.error("Please upload all three video files.")

st.markdown("---")
st.markdown("Cheating Detection Dashboard")
