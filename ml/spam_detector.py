"""
SpamDetector Class - Wrapper for loading and using the trained LSTM spam detection model

This class handles:
- Loading the trained PyTorch model weights
- Loading the vocabulary dictionary
- Preprocessing email text for model input
- Making spam predictions on email text
"""

import torch
import pickle
import re
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from ml.spam_model import SpamClassifier
from backend.config import *

class SpamDetector:
    """
    Wrapper class for the spam detection LSTM model.
    Handles model loading, text preprocessing, and spam prediction.
    """
    def __init__(self):
        """
        Initializes the SpamDetector by loading the model and vocabulary.
        Automatically detects if GPU (CUDA) is available for faster inference.
        """
        self.model = None  # Will hold the loaded PyTorch model
        self.vocab = None  # Will hold the vocabulary dictionary (word -> index mapping)
        # Use GPU if available, otherwise use CPU
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        self.load_model()  # Load model weights and vocabulary
    
    def load_model(self):
        """
        Loads the trained PyTorch model weights and vocabulary dictionary
        Sets model to evaluation mode and moves to appropriate device (CPU/GPU)
        Raises FileNotFoundError if model files don't exist
        """
        try:
            # Initialize model architecture with the same dimensions used during training
            self.model = SpamClassifier(VOCAB_SIZE, EMBEDDING_DIM, HIDDEN_DIM, NUM_CLASSES)
            
            # Load trained model weights from disk
            model_path = os.path.join(os.path.dirname(__file__), '..', MODEL_PATH)
            self.model.load_state_dict(torch.load(model_path, map_location=self.device))
            
            # Set model to evaluation mode (disables dropout, batch norm updates)
            self.model.eval()
            
            # Move model to appropriate device (CPU or GPU)
            self.model.to(self.device)
            
            # Load vocabulary dictionary from pickle file
            # Vocabulary maps words to integer indices for model input
            vocab_path = os.path.join(os.path.dirname(__file__), '..', 'vocab.pkl')
            with open(vocab_path, 'rb') as f:
                self.vocab = pickle.load(f)
            
            print("Model loaded successfully")
        except FileNotFoundError as e:
            print(f"Model not found. Please train the model first using train_model.py")
            print(f"Error: {e}")
            raise
        except Exception as e:
            print(f"Error loading model: {e}")
            raise
    
    def preprocess_text(self, text):
        """
        Converts email text into a tensor of word indices for model input
        - Lowercases text and splits into words
        - Maps words to vocabulary indices (unknown words → 1)
        - Pads or truncates to MAX_SEQUENCE_LENGTH (500 tokens)
        
        @param text: Raw email text string
        @returns: PyTorch tensor of shape [1, MAX_SEQUENCE_LENGTH]
        """
        # Step 1: Normalize text to lowercase and split into words
        words = text.lower().split()
        
        # Step 2: Convert words to indices using vocabulary
        # Unknown words (not in vocab) get mapped to 1 (<UNK> token)
        # Limit to MAX_SEQUENCE_LENGTH to prevent overly long sequences
        sequence = [self.vocab.get(word, 1) for word in words[:MAX_SEQUENCE_LENGTH]]
        
        # Step 3: Pad or truncate sequence to exactly MAX_SEQUENCE_LENGTH
        # Padding uses 0 (<PAD> token) at the end if sequence is too short
        if len(sequence) < MAX_SEQUENCE_LENGTH:
            # Pad with zeros at the end
            sequence += [0] * (MAX_SEQUENCE_LENGTH - len(sequence))
        else:
            # Truncate if too long
            sequence = sequence[:MAX_SEQUENCE_LENGTH]
        
        # Step 4: Convert to PyTorch tensor and move to appropriate device
        # Shape: [1, MAX_SEQUENCE_LENGTH] - batch size 1, sequence length MAX_SEQUENCE_LENGTH
        return torch.tensor([sequence], dtype=torch.long).to(self.device)
    
    def predict(self, text):
        """
        Predicts if an email is spam using the loaded LSTM model
        
        @param text: Email text to analyze
        @returns: Tuple of (is_spam: bool, confidence: float)
                  confidence is the probability of spam (0-1)
        """
        # Disable gradient computation for inference (faster, less memory)
        with torch.no_grad():
            # Step 1: Preprocess text into tensor format
            processed = self.preprocess_text(text)
            
            # Step 2: Forward pass through the neural network
            # Output shape: [1, 2] - logits for ham (class 0) and spam (class 1)
            output = self.model(processed)
            
            # Step 3: Convert logits to probabilities using softmax
            # probabilities[0][0] = P(ham), probabilities[0][1] = P(spam)
            probabilities = torch.softmax(output, dim=1)
            
            # Step 4: Extract spam probability (class 1)
            spam_prob = probabilities[0][1].item()
            
            # Step 5: Classify as spam if probability > 0.5 (threshold)
            is_spam = spam_prob > 0.5
        
        # Return classification result and confidence score
        return is_spam, spam_prob