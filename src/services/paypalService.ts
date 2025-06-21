interface PayPalOrderResponse {
  id: string;
  status: string;
  links: Array<{
    href: string;
    rel: string;
    method: string;
  }>;
}

interface PayPalCaptureResponse {
  id: string;
  status: string;
  purchase_units: Array<{
    payments: {
      captures: Array<{
        id: string;
        status: string;
        amount: {
          currency_code: string;
          value: string;
        };
      }>;
    };
  }>;
}

class PayPalService {
  private clientId: string;
  private environment: 'sandbox' | 'production';
  private baseUrl: string;

  constructor() {
    // Use environment variables or default to sandbox
    this.clientId = import.meta.env.VITE_PAYPAL_CLIENT_ID || 'your-paypal-client-id';
    this.environment = import.meta.env.VITE_PAYPAL_ENVIRONMENT === 'production' ? 'production' : 'sandbox';
    this.baseUrl = this.environment === 'production' 
      ? 'https://api-m.paypal.com' 
      : 'https://api-m.sandbox.paypal.com';
  }

  // Load PayPal SDK dynamically
  async loadPayPalSDK(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Check if PayPal SDK is already loaded
      if (window.paypal) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = `https://www.paypal.com/sdk/js?client-id=${this.clientId}&currency=USD&intent=capture`;
      script.async = true;
      
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load PayPal SDK'));
      
      document.head.appendChild(script);
    });
  }

  // Create PayPal order for Pro subscription
  async createOrder(): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}/v2/checkout/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await this.getAccessToken()}`,
        },
        body: JSON.stringify({
          intent: 'CAPTURE',
          purchase_units: [{
            amount: {
              currency_code: 'USD',
              value: '9.99'
            },
            description: 'ModelMix Pro Plan - Monthly Subscription'
          }],
          application_context: {
            return_url: `${window.location.origin}/payment/success`,
            cancel_url: `${window.location.origin}/payment/cancel`,
            brand_name: 'ModelMix',
            user_action: 'PAY_NOW'
          }
        })
      });

      if (!response.ok) {
        throw new Error(`PayPal API error: ${response.status}`);
      }

      const order: PayPalOrderResponse = await response.json();
      return order.id;
    } catch (error) {
      console.error('Failed to create PayPal order:', error);
      throw new Error('Failed to create payment order');
    }
  }

  // Capture PayPal payment
  async captureOrder(orderId: string): Promise<PayPalCaptureResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/v2/checkout/orders/${orderId}/capture`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await this.getAccessToken()}`,
        }
      });

      if (!response.ok) {
        throw new Error(`PayPal capture error: ${response.status}`);
      }

      const capture: PayPalCaptureResponse = await response.json();
      return capture;
    } catch (error) {
      console.error('Failed to capture PayPal payment:', error);
      throw new Error('Failed to process payment');
    }
  }

  // Get PayPal access token
  private async getAccessToken(): Promise<string> {
    try {
      // In a real application, this should be done on your backend for security
      // This is a simplified example for demonstration
      const clientSecret = import.meta.env.VITE_PAYPAL_CLIENT_SECRET || 'your-paypal-client-secret';
      
      const response = await fetch(`${this.baseUrl}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${btoa(`${this.clientId}:${clientSecret}`)}`
        },
        body: 'grant_type=client_credentials'
      });

      if (!response.ok) {
        throw new Error(`PayPal auth error: ${response.status}`);
      }

      const data = await response.json();
      return data.access_token;
    } catch (error) {
      console.error('Failed to get PayPal access token:', error);
      throw new Error('Failed to authenticate with PayPal');
    }
  }

  // Initialize PayPal buttons
  async initializePayPalButtons(containerId: string, onSuccess: (details: any) => void, onError: (error: any) => void): Promise<void> {
    await this.loadPayPalSDK();

    if (!window.paypal) {
      throw new Error('PayPal SDK not loaded');
    }

    window.paypal.Buttons({
      style: {
        layout: 'vertical',
        color: 'gold',
        shape: 'rect',
        label: 'paypal',
        height: 45
      },
      createOrder: async () => {
        try {
          return await this.createOrder();
        } catch (error) {
          onError(error);
          throw error;
        }
      },
      onApprove: async (data: any) => {
        try {
          const capture = await this.captureOrder(data.orderID);
          onSuccess({
            orderID: data.orderID,
            capture,
            paymentID: capture.purchase_units[0]?.payments?.captures[0]?.id
          });
        } catch (error) {
          onError(error);
        }
      },
      onError: (error: any) => {
        console.error('PayPal button error:', error);
        onError(error);
      },
      onCancel: (data: any) => {
        console.log('PayPal payment cancelled:', data);
        onError(new Error('Payment was cancelled'));
      }
    }).render(`#${containerId}`);
  }

  // Validate PayPal configuration
  isConfigured(): boolean {
    return !!(this.clientId && this.clientId !== 'your-paypal-client-id');
  }

  // Get environment info
  getEnvironmentInfo() {
    return {
      environment: this.environment,
      clientId: this.clientId,
      configured: this.isConfigured()
    };
  }
}

// Extend window interface for PayPal SDK
declare global {
  interface Window {
    paypal?: any;
  }
}

export const paypalService = new PayPalService();