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
    def __init__(self, texts, labels, vocab):
        self.texts = texts
        self.labels = labels
        self.vocab = vocab
    
    def __len__(self):
        return len(self.texts)
    
    def __getitem__(self, idx):
        text = self.texts[idx]
        # Convert text to sequence of word indices
        sequence = [self.vocab.get(word, 0) for word in text.split()[:MAX_SEQUENCE_LENGTH]]
        # Pad or truncate
        if len(sequence) < MAX_SEQUENCE_LENGTH:
            sequence += [0] * (MAX_SEQUENCE_LENGTH - len(sequence))
        else:
            sequence = sequence[:MAX_SEQUENCE_LENGTH]
        
        return torch.tensor(sequence, dtype=torch.long), torch.tensor(self.labels[idx], dtype=torch.long)

def build_vocab(texts, max_vocab_size=VOCAB_SIZE):
    """Build vocabulary from texts"""
    word_counts = {}
    for text in texts:
        for word in text.lower().split():
            word_counts[word] = word_counts.get(word, 0) + 1
    
    # Sort by frequency
    sorted_words = sorted(word_counts.items(), key=lambda x: x[1], reverse=True)
    vocab = {'<PAD>': 0, '<UNK>': 1}
    
    for word, count in sorted_words[:max_vocab_size-2]:
        vocab[word] = len(vocab)
    
    return vocab

def prepare_data(texts, labels):
    """Prepare training data"""
    # Build vocabulary
    vocab = build_vocab(texts)
    
    # Create dataset
    dataset = EmailDataset(texts, labels, vocab)
    
    return dataset, vocab

def load_data_from_csv(csv_path=None):
    """Load email data from CSV file"""
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
    """Train the spam detection model"""
    print("Preparing data...")
    dataset, vocab = prepare_data(texts, labels)
    
    # Split data
    train_size = int(0.8 * len(dataset))
    val_size = len(dataset) - train_size
    train_dataset, val_dataset = torch.utils.data.random_split(dataset, [train_size, val_size])
    
    train_loader = DataLoader(train_dataset, batch_size=BATCH_SIZE, shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=BATCH_SIZE, shuffle=False)
    
    # Initialize model
    model = SpamClassifier(VOCAB_SIZE, EMBEDDING_DIM, HIDDEN_DIM, NUM_CLASSES)
    criterion = nn.CrossEntropyLoss()
    optimizer = optim.Adam(model.parameters(), lr=LEARNING_RATE)
    
    print("Training model...")
    for epoch in range(NUM_EPOCHS):
        model.train()
        train_loss = 0
        for texts_batch, labels_batch in train_loader:
            optimizer.zero_grad()
            outputs = model(texts_batch)
            loss = criterion(outputs, labels_batch)
            loss.backward()
            optimizer.step()
            train_loss += loss.item()
        
        # Validation
        model.eval()
        val_loss = 0
        correct = 0
        total = 0
        with torch.no_grad():
            for texts_batch, labels_batch in val_loader:
                outputs = model(texts_batch)
                loss = criterion(outputs, labels_batch)
                val_loss += loss.item()
                _, predicted = torch.max(outputs.data, 1)
                total += labels_batch.size(0)
                correct += (predicted == labels_batch).sum().item()
        
        accuracy = 100 * correct / total
        print(f"Epoch {epoch+1}/{NUM_EPOCHS}")
        print(f"Train Loss: {train_loss/len(train_loader):.4f}, Val Loss: {val_loss/len(val_loader):.4f}, Accuracy: {accuracy:.2f}%")
    
    # Save model and vocab
    model_path = os.path.join(os.path.dirname(__file__), '..', MODEL_PATH)
    vocab_path = os.path.join(os.path.dirname(__file__), '..', 'vocab.pkl')
    torch.save(model.state_dict(), model_path)
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