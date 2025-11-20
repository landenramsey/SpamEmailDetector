"""
SpamClassifier Neural Network Architecture

Defines the PyTorch LSTM model for spam detection:
- Embedding layer: Maps word indices to dense vectors
- LSTM layer: Processes sequential patterns in email text
- Fully connected layers: Classifies spam vs ham
"""

import torch
import torch.nn as nn
import torch.nn.functional as F

class SpamClassifier(nn.Module):
    """
    Bidirectional LSTM neural network for spam classification.
    
    Architecture:
    1. Embedding: word_index -> dense_vector (128 dim)
    2. LSTM: bidirectional 2-layer LSTM (256 hidden units)
    3. Fully Connected: 256 -> 128 -> 2 (ham/spam)
    """
    def __init__(self, vocab_size, embedding_dim, hidden_dim, num_classes, num_layers=2):
        """
        Initializes the neural network layers.
        
        @param vocab_size: Size of vocabulary (number of unique words)
        @param embedding_dim: Dimension of word embeddings (128)
        @param hidden_dim: LSTM hidden state size (256)
        @param num_classes: Number of output classes (2: ham/spam)
        @param num_layers: Number of LSTM layers (2)
        """
        super(SpamClassifier, self).__init__()
        
        # Embedding layer: converts word indices to dense vectors
        # Input: word indices, Output: embedding_dim-dimensional vectors
        self.embedding = nn.Embedding(vocab_size, embedding_dim)
        
        # Bidirectional LSTM: processes sequences in both directions
        # batch_first=True: input shape is [batch, sequence, features]
        # dropout=0.3: regularization to prevent overfitting
        self.lstm = nn.LSTM(embedding_dim, hidden_dim, num_layers, 
                           batch_first=True, dropout=0.3)
        
        # Fully connected layer 1: reduces LSTM output to 128 dimensions
        self.fc1 = nn.Linear(hidden_dim, 128)
        
        # Dropout layer: randomly sets 50% of inputs to 0 during training
        self.dropout = nn.Dropout(0.5)
        
        # Fully connected layer 2: final classification (128 -> 2 classes)
        self.fc2 = nn.Linear(128, num_classes)
        
    def forward(self, x):
        """
        Forward pass through the neural network
        @param x: Input tensor of word indices [batch_size, sequence_length]
        @returns: Logits tensor [batch_size, num_classes] (2 classes: ham/spam)
        """
        # Step 1: Convert word indices to dense embeddings
        # x shape: [batch_size, sequence_length]
        # embedded shape: [batch_size, sequence_length, embedding_dim]
        embedded = self.embedding(x)
        
        # Step 2: Process through LSTM
        # lstm_out: output for each timestep [batch_size, sequence_length, hidden_dim]
        # hidden: final hidden state for each layer [num_layers, batch_size, hidden_dim]
        lstm_out, (hidden, _) = self.lstm(embedded)
        
        # Step 3: Use the last layer's hidden state (final representation)
        # hidden[-1] shape: [batch_size, hidden_dim]
        last_hidden = hidden[-1]
        
        # Step 4: Pass through first fully connected layer with ReLU activation
        # ReLU: Rectified Linear Unit (max(0, x)) for non-linearity
        out = self.fc1(last_hidden)
        out = F.relu(out)
        
        # Step 5: Apply dropout (only active during training)
        out = self.dropout(out)
        
        # Step 6: Final classification layer (output logits)
        # out shape: [batch_size, num_classes] - raw scores for each class
        out = self.fc2(out)
        return out