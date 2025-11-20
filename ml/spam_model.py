import torch
import torch.nn as nn
import torch.nn.functional as F

class SpamClassifier(nn.Module):
    def __init__(self, vocab_size, embedding_dim, hidden_dim, num_classes, num_layers=2):
        super(SpamClassifier, self).__init__()
        self.embedding = nn.Embedding(vocab_size, embedding_dim)
        self.lstm = nn.LSTM(embedding_dim, hidden_dim, num_layers, 
                           batch_first=True, dropout=0.3)
        self.fc1 = nn.Linear(hidden_dim, 128)
        self.dropout = nn.Dropout(0.5)
        self.fc2 = nn.Linear(128, num_classes)
        
    def forward(self, x):
        """
        Forward pass through the neural network
        @param x: Input tensor of word indices [batch_size, sequence_length]
        @returns: Logits tensor [batch_size, num_classes] (2 classes: ham/spam)
        """
        embedded = self.embedding(x)
        lstm_out, (hidden, _) = self.lstm(embedded)
        # Use the last hidden state
        last_hidden = hidden[-1]
        out = self.fc1(last_hidden)
        out = F.relu(out)
        out = self.dropout(out)
        out = self.fc2(out)
        return out