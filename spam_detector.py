import torch
import pickle
import re
from spam_model import SpamClassifier
from email_fetcher import EmailFetcher
from config import *

class SpamDetector:
    def __init__(self):
        self.model = None
        self.vocab = None
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        self.load_model()
    
    def load_model(self):
        """Load trained model and vocabulary"""
        try:
            self.model = SpamClassifier(VOCAB_SIZE, EMBEDDING_DIM, HIDDEN_DIM, NUM_CLASSES)
            self.model.load_state_dict(torch.load(MODEL_PATH, map_location=self.device))
            self.model.eval()
            self.model.to(self.device)
            
            with open('vocab.pkl', 'rb') as f:
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
        """Preprocess text for prediction"""
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
        """Predict if email is spam"""
        with torch.no_grad():
            processed = self.preprocess_text(text)
            output = self.model(processed)
            probabilities = torch.softmax(output, dim=1)
            spam_prob = probabilities[0][1].item()
            is_spam = spam_prob > 0.5
        
        return is_spam, spam_prob
    
    def process_emails(self, dry_run=True):
        """Process emails and delete spam"""
        print("Starting email spam detection...")
        print(f"Dry run mode: {dry_run}")
        
        # Check if credentials are set
        if not EMAIL_USER or not EMAIL_PASSWORD:
            print("ERROR: Email credentials not configured!")
            print("Please create a .env file with EMAIL_USER and EMAIL_PASSWORD")
            print(f"Current EMAIL_USER: '{EMAIL_USER}'")
            print(f"Current EMAIL_PASSWORD: {'*' * len(EMAIL_PASSWORD) if EMAIL_PASSWORD else '(empty)'}")
            return
        
        print(f"Connecting to {EMAIL_HOST}:{EMAIL_PORT} as {EMAIL_USER}...")
        
        # Connect to email
        try:
            fetcher = EmailFetcher(EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASSWORD)
            fetcher.connect()
            print("Connected successfully!")
        except Exception as e:
            print(f"ERROR: Failed to connect to email server: {e}")
            print(f"Host: {EMAIL_HOST}, Port: {EMAIL_PORT}, User: {EMAIL_USER}")
            import traceback
            traceback.print_exc()
            return
        
        # Fetch emails
        print("Fetching emails...")
        try:
            emails = fetcher.fetch_emails(limit=100)  # Adjust limit as needed
            print(f"Fetched {len(emails)} emails")
        except Exception as e:
            print(f"ERROR: Failed to fetch emails: {e}")
            import traceback
            traceback.print_exc()
            fetcher.disconnect()
            return
        
        spam_count = 0
        deleted_count = 0
        
        for email_data in emails:
            try:
                is_spam, confidence = self.predict(email_data['text'])
                
                if is_spam:
                    spam_count += 1
                    print(f"\nSpam detected (confidence: {confidence:.2%}):")
                    print(f"  From: {email_data['from']}")
                    print(f"  Subject: {email_data['subject'][:50]}...")
                    
                    # Only delete if confidence is above threshold
                    if confidence >= CONFIDENCE_THRESHOLD:
                        if dry_run:
                            print(f"  [DRY RUN] Would delete email {email_data['id']}")
                        else:
                            fetcher.delete_email(email_data['id'])
                            deleted_count += 1
                            print(f"  Deleted email {email_data['id']}")
            except Exception as e:
                print(f"Error processing email {email_data.get('id', 'unknown')}: {e}")
                continue
        
        print(f"\nSummary:")
        print(f"  Total emails processed: {len(emails)}")
        print(f"  Spam detected: {spam_count}")
        print(f"  Deleted: {deleted_count}")
        
        fetcher.disconnect()
        print("Done!")

if __name__ == "__main__":
    try:
        detector = SpamDetector()
        detector.process_emails(dry_run=DRY_RUN)
    except Exception as e:
        print(f"Fatal error: {e}")
        import traceback
        traceback.print_exc()