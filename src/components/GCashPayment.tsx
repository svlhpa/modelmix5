import React, { useState, useRef } from 'react';
import { Upload, Send, CheckCircle, AlertCircle, X, Phone, Mail, User, Image, Clock } from 'lucide-react';
import { emailService, GCashPaymentData } from '../services/emailService';

interface GCashPaymentProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export const GCashPayment: React.FC<GCashPaymentProps> = ({ onSuccess, onCancel }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    contactNumber: ''
  });
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file (PNG, JPG, etc.)');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image file must be less than 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      setReceiptImage(base64);
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.email || !formData.contactNumber || !receiptImage) {
      setError('Please fill in all fields and upload your receipt screenshot');
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('Please enter a valid email address');
      return;
    }

    // Validate Philippine phone number format
    const phoneRegex = /^(\+63|0)?9\d{9}$/;
    if (!phoneRegex.test(formData.contactNumber.replace(/\s/g, ''))) {
      setError('Please enter a valid Philippine mobile number (e.g., 09123456789)');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const paymentData: GCashPaymentData = {
        name: formData.name,
        email: formData.email,
        contactNumber: formData.contactNumber,
        receiptImage,
        timestamp: new Date()
      };

      // Store payment data and send email notification
      await emailService.storeGCashPayment(paymentData);
      await emailService.sendGCashPaymentNotification(paymentData);

      setSuccess(true);
      
      // Auto-close after showing success message
      setTimeout(() => {
        onSuccess();
      }, 3000);
    } catch (error) {
      console.error('Failed to process GCash payment:', error);
      setError('Failed to submit payment information. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="text-center p-6 animate-fadeInUp">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle size={32} className="text-green-600" />
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">Payment Submitted!</h3>
        <p className="text-gray-600 mb-4">
          Your GCash payment information has been sent to our team for verification.
        </p>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <div className="flex items-center space-x-2 text-blue-800 mb-2">
            <Clock size={20} />
            <span className="font-medium">Processing Time</span>
          </div>
          <p className="text-sm text-blue-700">
            Your account will be upgraded to Pro within <strong>1 business day</strong> after payment verification.
            You'll receive an email confirmation once your account is upgraded.
          </p>
        </div>
        <p className="text-sm text-gray-500">
          If you have any questions, please contact support with your payment details.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* GCash QR Code */}
      <div className="text-center">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Pay with GCash</h3>
        <div className="bg-white border border-gray-200 rounded-lg p-4 inline-block">
          <img 
            src="/photo_2025-06-21_13-48-43.jpg" 
            alt="GCash QR Code" 
            className="w-64 h-auto mx-auto rounded-lg"
          />
        </div>
        <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-lg font-bold text-blue-900">₱580.00 PHP</p>
          <p className="text-sm text-blue-700">ModelMix Pro Monthly Subscription</p>
        </div>
      </div>

      {/* Payment Instructions */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <h4 className="font-medium text-amber-800 mb-2">Payment Instructions:</h4>
        <ol className="text-sm text-amber-700 space-y-1">
          <li>1. Open your GCash app</li>
          <li>2. Scan the QR code above or send ₱580.00 to the account shown</li>
          <li>3. Take a screenshot of your payment confirmation</li>
          <li>4. Fill out the form below and upload your screenshot</li>
          <li>5. Wait for account upgrade within 1 business day</li>
        </ol>
      </div>

      {/* Payment Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <User size={16} className="inline mr-1" />
            Full Name *
          </label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter your full name"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Mail size={16} className="inline mr-1" />
            Email Address *
          </label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter your email address"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Phone size={16} className="inline mr-1" />
            Contact Number *
          </label>
          <input
            type="tel"
            name="contactNumber"
            value={formData.contactNumber}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="09123456789"
            required
          />
          <p className="text-xs text-gray-500 mt-1">Philippine mobile number format</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Image size={16} className="inline mr-1" />
            Payment Receipt Screenshot *
          </label>
          
          {!receiptImage ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
            >
              <Upload className="mx-auto text-gray-400 mb-2" size={24} />
              <p className="text-sm text-gray-600">Click to upload your GCash receipt screenshot</p>
              <p className="text-xs text-gray-500 mt-1">PNG, JPG, or other image formats (max 5MB)</p>
            </div>
          ) : (
            <div className="relative">
              <img 
                src={receiptImage} 
                alt="Receipt" 
                className="w-full max-w-xs mx-auto border border-gray-200 rounded-lg"
              />
              <button
                type="button"
                onClick={() => setReceiptImage(null)}
                className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
              >
                <X size={16} />
              </button>
              <p className="text-sm text-green-600 text-center mt-2">
                <CheckCircle size={16} className="inline mr-1" />
                Receipt uploaded successfully
              </p>
            </div>
          )}
          
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 animate-shakeX">
            <div className="flex items-center space-x-2 text-red-700">
              <AlertCircle size={16} />
              <span className="text-sm">{error}</span>
            </div>
          </div>
        )}

        <div className="flex space-x-3 pt-4">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || !formData.name || !formData.email || !formData.contactNumber || !receiptImage}
            className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Submitting...</span>
              </>
            ) : (
              <>
                <Send size={16} />
                <span>Submit Payment</span>
              </>
            )}
          </button>
        </div>
      </form>

      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h4 className="font-medium text-gray-800 mb-2">Important Notes:</h4>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• Your payment information will be sent to our team for verification</li>
          <li>• Account upgrade will be processed within 1 business day</li>
          <li>• You'll receive an email confirmation once your account is upgraded</li>
          <li>• Keep your payment receipt for your records</li>
          <li>• Contact support if you don't receive confirmation within 2 business days</li>
        </ul>
      </div>
    </div>
  );
};