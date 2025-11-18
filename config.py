import os
from dotenv import load_dotenv

load_dotenv()

# Email Configuration
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
MODEL_PATH = 'spam_model.pth'
VOCAB_SIZE = 10000
EMBEDDING_DIM = 128
HIDDEN_DIM = 256
NUM_CLASSES = 2  # spam or not spam

# Training Configuration
BATCH_SIZE = 32
LEARNING_RATE = 0.001
NUM_EPOCHS = 10
MAX_SEQUENCE_LENGTH = 500

# Safety Configuration
DRY_RUN = True  # Set to False to actually delete emails
CONFIDENCE_THRESHOLD = 0.9  # Only delete if spam confidence > 90%