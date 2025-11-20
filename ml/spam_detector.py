import torch
import pickle
import re
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from ml.spam_model import SpamClassifier
from backend.config import *

class SpamDetector:
    def __init__(self):
        self.model = None
        self.vocab = None
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        self.load_model()
    
    def load_model(self):
        """
        Loads the trained PyTorch model weights and vocabulary dictionary
        Sets model to evaluation mode and moves to appropriate device (CPU/GPU)
        Raises FileNotFoundError if model files don't exist
        """
        try:
            self.model = SpamClassifier(VOCAB_SIZE, EMBEDDING_DIM, HIDDEN_DIM, NUM_CLASSES)
            model_path = os.path.join(os.path.dirname(__file__), '..', MODEL_PATH)
            self.model.load_state_dict(torch.load(model_path, map_location=self.device))
            self.model.eval()
            self.model.to(self.device)
            
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
        # Convert to lowercase and split
        words = text.lower().split()
        # Convert to sequence
        sequence = [self.vocab.get(word, 1) for word in words[:MAX_SEQUENCE_LENGTH]]
        # Pad or truncate
        if len(sequence) < MAX_SEQUENCE_LENGTH:
            sequence += [0] * (MAX_SEQUENCE_LENGTH - len(sequence))
        else:
            sequence = sequence[:MAX_SEQUENCE_LENGTH]
        
        return torch.tensor([sequence], dtype=torch.long).to(self.device)
    
    def predict(self, text):
        """
        Predicts if an email is spam using the loaded LSTM model
        
        @param text: Email text to analyze
        @returns: Tuple of (is_spam: bool, confidence: float)
                  confidence is the probability of spam (0-1)
        """
        with torch.no_grad():
            processed = self.preprocess_text(text)
            output = self.model(processed)
            probabilities = torch.softmax(output, dim=1)
            spam_prob = probabilities[0][1].item()
            is_spam = spam_prob > 0.5
        
        return is_spam, spam_prob