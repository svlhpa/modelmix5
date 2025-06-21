interface GCashPaymentData {
  name: string;
  email: string;
  contactNumber: string;
  receiptImage: string; // Base64 encoded image
  timestamp: Date;
}

class EmailService {
  async sendGCashPaymentNotification(paymentData: GCashPaymentData): Promise<void> {
    try {
      // In a real application, you would use a backend service like:
      // - EmailJS
      // - SendGrid
      // - Nodemailer with a backend API
      // - Supabase Edge Functions
      
      // For now, we'll simulate the email sending
      const emailContent = {
        to: 'aphilvs@gmail.com',
        subject: 'New GCash Payment - ModelMix Pro Subscription',
        html: `
          <h2>New GCash Payment Received</h2>
          <p><strong>Customer Details:</strong></p>
          <ul>
            <li><strong>Name:</strong> ${paymentData.name}</li>
            <li><strong>Email:</strong> ${paymentData.email}</li>
            <li><strong>Contact Number:</strong> ${paymentData.contactNumber}</li>
            <li><strong>Payment Date:</strong> ${paymentData.timestamp.toLocaleString()}</li>
            <li><strong>Amount:</strong> ₱580.00 PHP</li>
            <li><strong>Product:</strong> ModelMix Pro Monthly Subscription</li>
          </ul>
          
          <p><strong>Receipt Screenshot:</strong></p>
          <img src="${paymentData.receiptImage}" alt="Payment Receipt" style="max-width: 400px; border: 1px solid #ccc;" />
          
          <hr />
          <p><em>Please process this payment within 1 business day and upgrade the user's account to Pro tier.</em></p>
        `
      };

      // Simulate API call to email service
      console.log('Sending email notification:', emailContent);
      
      // In a real implementation, you would make an API call here:
      // const response = await fetch('/api/send-email', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(emailContent)
      // });
      
      // For demo purposes, we'll just log and resolve
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      console.log('Email sent successfully to aphilvs@gmail.com');
    } catch (error) {
      console.error('Failed to send email notification:', error);
      throw new Error('Failed to send payment notification email');
    }
  }

  // Store payment data locally for admin review
  async storeGCashPayment(paymentData: GCashPaymentData): Promise<string> {
    const paymentId = `gcash-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Store in localStorage for demo purposes
    // In a real app, this would be stored in a database
    const existingPayments = JSON.parse(localStorage.getItem('gcash-payments') || '[]');
    const paymentRecord = {
      id: paymentId,
      ...paymentData,
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    
    existingPayments.push(paymentRecord);
    localStorage.setItem('gcash-payments', JSON.stringify(existingPayments));
    
    return paymentId;
  }
}

export const emailService = new EmailService();
export type { GCashPaymentData };