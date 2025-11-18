import imapclient
import email
from email.header import decode_header
from typing import List, Dict
import re
import socket
import ssl

class EmailFetcher:
    def __init__(self, host, port, user, password):
        self.host = host
        self.port = port
        self.user = user
        self.password = password
        self.imap = None
    
    def connect(self):
        """Connect to email server"""
        try:
            # Set socket timeout
            socket.setdefaulttimeout(30)  # 30 second timeout
            
            print(f"Attempting to connect to {self.host}:{self.port}...")
            
            # Create SSL context
            ssl_context = ssl.create_default_context()
            # For macOS certificate issues, you can uncomment the next line if needed:
            # ssl_context.check_hostname = False
            # ssl_context.verify_mode = ssl.CERT_NONE
            
            self.imap = imapclient.IMAPClient(
                self.host, 
                port=self.port, 
                ssl=True, 
                timeout=30,
                ssl_context=ssl_context
            )
            
            print("Logging in...")
            self.imap.login(self.user, self.password)
            
            print("Selecting INBOX...")
            self.imap.select_folder('INBOX')
            
            print("Connected to email server successfully!")
        except socket.timeout:
            print("ERROR: Connection timed out. Check your internet connection and email settings.")
            raise
        except imapclient.exceptions.LoginError:
            print("ERROR: Login failed. Check your email and password (use app-specific password for Gmail).")
            raise
        except ssl.SSLError as e:
            print(f"ERROR: SSL certificate verification failed: {e}")
            print("\nTo fix this, try running:")
            print("  /Applications/Python\\ 3.12/Install\\ Certificates.command")
            print("\nOr install certifi:")
            print("  python3 -m pip install --upgrade certifi")
            raise
        except Exception as e:
            print(f"ERROR: Failed to connect: {e}")
            raise
    
    def disconnect(self):
        """Disconnect from email server"""
        if self.imap:
            try:
                self.imap.logout()
            except:
                pass
    
    def decode_mime_words(self, s):
        """Decode MIME encoded words"""
        return ''.join(
            word.decode(encoding or 'utf8') if isinstance(word, bytes) else word
            for word, encoding in decode_header(s)
        )
    
    def fetch_emails(self, limit=100) -> List[Dict]:
        """Fetch emails from inbox"""
        if not self.imap:
            self.connect()
        
        print("Searching for emails...")
        messages = self.imap.search(['ALL'])
        total_messages = len(messages)
        print(f"Found {total_messages} emails in inbox")
        
        # Limit the number of emails
        messages = messages[:limit] if limit else messages
        print(f"Processing {len(messages)} emails...")
        
        emails = []
        
        for idx, msg_id in enumerate(messages, 1):
            try:
                if idx % 10 == 0 or idx == 1:
                    print(f"  Processing email {idx}/{len(messages)}...")
                
                msg_data = self.imap.fetch([msg_id], ['RFC822', 'FLAGS'])[msg_id]
                email_body = msg_data[b'RFC822']
                email_message = email.message_from_bytes(email_body)
                
                # Extract email content
                subject = self.decode_mime_words(email_message.get('Subject', ''))
                from_addr = self.decode_mime_words(email_message.get('From', ''))
                
                # Get email body
                body = ""
                if email_message.is_multipart():
                    for part in email_message.walk():
                        content_type = part.get_content_type()
                        if content_type == "text/plain":
                            try:
                                body = part.get_payload(decode=True).decode('utf-8', errors='ignore')
                                break
                            except:
                                pass
                else:
                    try:
                        body = email_message.get_payload(decode=True).decode('utf-8', errors='ignore')
                    except:
                        body = str(email_message.get_payload())
                
                emails.append({
                    'id': msg_id,
                    'subject': subject,
                    'from': from_addr,
                    'body': body,
                    'text': f"{subject} {body}",  # Combined text for analysis
                    'flags': msg_data.get(b'FLAGS', [])
                })
            except Exception as e:
                print(f"Error fetching email {msg_id}: {e}")
                continue
        
        print(f"Successfully fetched {len(emails)} emails")
        return emails
    
    def delete_email(self, msg_id):
        """Delete an email by ID"""
        if self.imap:
            self.imap.set_flags([msg_id], [imapclient.DELETED])
            self.imap.expunge()
            print(f"Deleted email {msg_id}")
    
    def mark_as_read(self, msg_id):
        """Mark email as read"""
        if self.imap:
            self.imap.set_flags([msg_id], [imapclient.SEEN])