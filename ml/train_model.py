"""
Training script for the spam detection LSTM model.

This script:
1. Loads email data from CSV file
2. Builds vocabulary from training texts
3. Creates PyTorch Dataset and DataLoader
4. Trains the LSTM model with Adam optimizer
5. Validates on held-out data
6. Saves model weights and vocabulary to disk
"""

import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader
from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
import numpy as np
import pickle
import os
import pandas as pd
import sys
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from ml.spam_model import SpamClassifier
from backend.config import *

class EmailDataset(Dataset):
    """
    PyTorch Dataset for email spam classification.
    Converts email texts and labels into tensors for training.
    """
    def __init__(self, texts, labels, vocab):
        """
        Initialize dataset with email texts, labels, and vocabulary.
        
        @param texts: List of email text strings
        @param labels: List of spam labels (0=ham, 1=spam)
        @param vocab: Dictionary mapping words to indices
        """
        self.texts = texts
        self.labels = labels
        self.vocab = vocab
    
    def __len__(self):
        """Returns the number of emails in the dataset."""
        return len(self.texts)
    
    def __getitem__(self, idx):
        """
        Converts a single email text into a padded sequence of word indices
        @param idx: Index of the email in the dataset
        @returns: Tuple of (sequence_tensor, label_tensor)
        """
        # Get email text and label at given index
        text = self.texts[idx]
        
        # Convert text to sequence of word indices using vocabulary
        # Unknown words get index 0 (<PAD> token, though should be 1 <UNK>)
        # Limit length to MAX_SEQUENCE_LENGTH
        sequence = [self.vocab.get(word, 0) for word in text.split()[:MAX_SEQUENCE_LENGTH]]
        
        # Pad or truncate to exactly MAX_SEQUENCE_LENGTH
        if len(sequence) < MAX_SEQUENCE_LENGTH:
            # Pad with zeros (<PAD> token) if too short
            sequence += [0] * (MAX_SEQUENCE_LENGTH - len(sequence))
        else:
            # Truncate if too long
            sequence = sequence[:MAX_SEQUENCE_LENGTH]
        
        # Return as PyTorch tensors
        # sequence_tensor: [MAX_SEQUENCE_LENGTH] - word indices
        # label_tensor: scalar (0 or 1) - spam or ham
        return torch.tensor(sequence, dtype=torch.long), torch.tensor(self.labels[idx], dtype=torch.long)

def build_vocab(texts, max_vocab_size=VOCAB_SIZE):
    """
    Builds vocabulary dictionary from training texts
    - Counts word frequencies
    - Keeps top N most common words (default 10,000)
    - Adds <PAD>=0 and <UNK>=1 special tokens
    
    @param texts: List of email text strings
    @param max_vocab_size: Maximum vocabulary size
    @returns: Dictionary mapping words to indices
    """
    # Step 1: Count word frequencies across all training texts
    word_counts = {}
    for text in texts:
        # Normalize to lowercase and split into words
        for word in text.lower().split():
            word_counts[word] = word_counts.get(word, 0) + 1
    
    # Step 2: Sort words by frequency (most common first)
    sorted_words = sorted(word_counts.items(), key=lambda x: x[1], reverse=True)
    
    # Step 3: Initialize vocabulary with special tokens
    # <PAD>=0: Padding token for sequences shorter than MAX_SEQUENCE_LENGTH
    # <UNK>=1: Unknown token for words not in vocabulary
    vocab = {'<PAD>': 0, '<UNK>': 1}
    
    # Step 4: Add top N most frequent words to vocabulary
    # max_vocab_size-2 because we already added <PAD> and <UNK>
    for word, count in sorted_words[:max_vocab_size-2]:
        vocab[word] = len(vocab)  # Assign next available index
    
    return vocab

def prepare_data(texts, labels):
    """
    Prepares training data by building vocabulary and creating PyTorch Dataset
    @param texts: List of email text strings
    @param labels: List of spam labels (0=ham, 1=spam)
    @returns: Tuple of (EmailDataset, vocabulary_dict)
    """
    # Build vocabulary
    vocab = build_vocab(texts)
    
    # Create dataset
    dataset = EmailDataset(texts, labels, vocab)
    
    return dataset, vocab

def load_data_from_csv(csv_path=None):
    """
    Loads email training data from CSV file
    @param csv_path: Path to CSV file (defaults to data/emails.csv)
    @returns: Tuple of (texts_list, labels_list)
    """
    if csv_path is None:
        csv_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'emails.csv')
    print(f"Loading data from {csv_path}...")
    df = pd.read_csv(csv_path)
    
    # Extract text and labels
    texts = df['text'].astype(str).tolist()
    labels = df['spam'].astype(int).tolist()
    
    print(f"Loaded {len(texts)} emails")
    print(f"Spam: {sum(labels)}, Ham: {len(labels) - sum(labels)}")
    
    return texts, labels

def train_model(texts, labels):
    """
    Trains the LSTM spam detection model
    - Splits data into train/validation (80/20)
    - Trains for NUM_EPOCHS with Adam optimizer
    - Prints accuracy metrics after each epoch
    - Saves model weights and vocabulary to disk
    
    @param texts: List of email text strings
    @param labels: List of spam labels (0=ham, 1=spam)
    @returns: Tuple of (trained_model, vocabulary_dict)
    """
    print("Preparing data...")
    # Build vocabulary and create PyTorch Dataset
    dataset, vocab = prepare_data(texts, labels)
    
    # Split data into training (80%) and validation (20%) sets
    train_size = int(0.8 * len(dataset))
    val_size = len(dataset) - train_size
    train_dataset, val_dataset = torch.utils.data.random_split(dataset, [train_size, val_size])
    
    # Create DataLoaders for batching
    # shuffle=True: randomize order for training (prevents overfitting to data order)
    # shuffle=False: keep order for validation (consistent evaluation)
    train_loader = DataLoader(train_dataset, batch_size=BATCH_SIZE, shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=BATCH_SIZE, shuffle=False)
    
    # Initialize model with architecture hyperparameters
    model = SpamClassifier(VOCAB_SIZE, EMBEDDING_DIM, HIDDEN_DIM, NUM_CLASSES)
    
    # Loss function: Cross-entropy for multi-class classification
    criterion = nn.CrossEntropyLoss()
    
    # Optimizer: Adam adaptive learning rate optimizer
    optimizer = optim.Adam(model.parameters(), lr=LEARNING_RATE)
    
    print("Training model...")
    # Training loop: iterate through all epochs
    for epoch in range(NUM_EPOCHS):
        # Set model to training mode (enables dropout, batch norm updates)
        model.train()
        train_loss = 0
        
        # Training phase: iterate through batches
        for texts_batch, labels_batch in train_loader:
            # Clear gradients from previous iteration
            optimizer.zero_grad()
            
            # Forward pass: get model predictions
            outputs = model(texts_batch)
            
            # Calculate loss between predictions and true labels
            loss = criterion(outputs, labels_batch)
            
            # Backward pass: compute gradients
            loss.backward()
            
            # Update model weights using gradients
            optimizer.step()
            
            # Accumulate loss for logging
            train_loss += loss.item()
        
        # Validation phase: evaluate on held-out data
        model.eval()  # Set to evaluation mode (disables dropout, batch norm)
        val_loss = 0
        correct = 0  # Count of correct predictions
        total = 0    # Total number of predictions
        
        # Disable gradient computation during validation (faster)
        with torch.no_grad():
            for texts_batch, labels_batch in val_loader:
                # Forward pass
                outputs = model(texts_batch)
                
                # Calculate validation loss
                loss = criterion(outputs, labels_batch)
                val_loss += loss.item()
                
                # Get predicted classes (class with highest probability)
                _, predicted = torch.max(outputs.data, 1)
                
                # Count correct predictions
                total += labels_batch.size(0)
                correct += (predicted == labels_batch).sum().item()
        
        # Calculate accuracy percentage
        accuracy = 100 * correct / total
        
        # Print training progress
        print(f"Epoch {epoch+1}/{NUM_EPOCHS}")
        print(f"Train Loss: {train_loss/len(train_loader):.4f}, Val Loss: {val_loss/len(val_loader):.4f}, Accuracy: {accuracy:.2f}%")
    
    # Save trained model weights and vocabulary to disk
    # Model weights are saved separately from architecture (state_dict only)
    model_path = os.path.join(os.path.dirname(__file__), '..', MODEL_PATH)
    vocab_path = os.path.join(os.path.dirname(__file__), '..', 'vocab.pkl')
    
    # Save model weights (not full model, just parameters)
    torch.save(model.state_dict(), model_path)
    
    # Save vocabulary dictionary to pickle file
    with open(vocab_path, 'wb') as f:
        pickle.dump(vocab, f)
    
    print(f"Model saved to {model_path}")
    print(f"Vocabulary saved to {vocab_path}")
    return model, vocab

if __name__ == "__main__":
    # Load data from CSV
    texts, labels = load_data_from_csv()
    
    # Train the model
    train_model(texts, labels)