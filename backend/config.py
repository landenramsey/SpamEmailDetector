"""
Configuration file for Email Spam Detector
Contains all hyperparameters, file paths, and settings for the model and API
"""

import os
from dotenv import load_dotenv

# Load environment variables from .env file (if it exists)
load_dotenv()

# Email Configuration
# Note: These are legacy settings from CLI mode, not currently used by the browser extension
EMAIL_HOST = os.getenv('EMAIL_HOST', 'imap.gmail.com')
EMAIL_PORT = int(os.getenv('EMAIL_PORT', 993))
EMAIL_USER = os.getenv('EMAIL_USER', '')
EMAIL_PASSWORD = os.getenv('EMAIL_PASSWORD', '')

# Validate email configuration
if not EMAIL_USER or not EMAIL_PASSWORD:
    print("WARNING: EMAIL_USER or EMAIL_PASSWORD not set in .env file")
    print("Please create a .env file with your email credentials")
    print("Example:")
    print("  EMAIL_HOST=imap.gmail.com")
    print("  EMAIL_PORT=993")
    print("  EMAIL_USER=your_email@gmail.com")
    print("  EMAIL_PASSWORD=your_app_specific_password")

# Model Configuration
# Architecture hyperparameters for the LSTM neural network
MODEL_PATH = 'spam_model.pth'  # Path to trained model weights (relative to project root)
VOCAB_SIZE = 10000  # Number of words in vocabulary (critical: too small causes poor accuracy)
EMBEDDING_DIM = 128  # Dimension of word embeddings (vector size for each word)
HIDDEN_DIM = 256  # LSTM hidden state size (memory capacity)
NUM_CLASSES = 2  # Binary classification: spam (1) or ham (0)

# Training Configuration
# Parameters used when training the model (train_model.py)
BATCH_SIZE = 32  # Number of emails processed per training batch
LEARNING_RATE = 0.001  # Adam optimizer learning rate
NUM_EPOCHS = 10  # Number of complete passes through training data
MAX_SEQUENCE_LENGTH = 500  # Maximum tokens per email (pad/truncate to this length)

# Safety Configuration
# Legacy settings (not used in browser extension mode)
DRY_RUN = True  # Set to False to actually delete emails (legacy CLI feature)
CONFIDENCE_THRESHOLD = 0.9  # Only delete if spam confidence > 90% (legacy CLI feature)