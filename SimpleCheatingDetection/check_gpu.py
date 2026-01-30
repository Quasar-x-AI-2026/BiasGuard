
import tensorflow as tf
import torch
import sys

print(f"Python: {sys.version}")
print(f"TensorFlow: {tf.__version__}")
print(f"TensorFlow GPU devices: {tf.config.list_physical_devices('GPU')}")

print(f"PyTorch: {torch.__version__}")
print(f"PyTorch CUDA Available: {torch.cuda.is_available()}")
if torch.cuda.is_available():
    print(f"PyTorch CUDA Device: {torch.cuda.get_device_name(0)}")
