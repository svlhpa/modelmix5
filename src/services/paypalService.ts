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
  private sdkLoaded: boolean = false;

  constructor() {
    // Use environment variables or default to sandbox
    this.clientId = import.meta.env.VITE_PAYPAL_CLIENT_ID || '';
    this.environment = import.meta.env.VITE_PAYPAL_ENVIRONMENT === 'production' ? 'production' : 'sandbox';
    this.baseUrl = this.environment === 'production' 
      ? 'https://api-m.paypal.com' 
      : 'https://api-m.sandbox.paypal.com';
  }

  // Load PayPal SDK dynamically
  async loadPayPalSDK(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Check if PayPal SDK is already loaded
      if (window.paypal && this.sdkLoaded) {
        resolve();
        return;
      }

      // Remove existing script if any
      const existingScript = document.querySelector('script[src*="paypal.com/sdk/js"]');
      if (existingScript) {
        existingScript.remove();
      }

      const script = document.createElement('script');
      script.src = `https://www.paypal.com/sdk/js?client-id=${this.clientId}&currency=USD&intent=capture&disable-funding=credit,card`;
      script.async = true;
      
      script.onload = () => {
        this.sdkLoaded = true;
        resolve();
      };
      script.onerror = () => reject(new Error('Failed to load PayPal SDK'));
      
      document.head.appendChild(script);
    });
  }

  // Initialize PayPal buttons
  async initializePayPalButtons(containerId: string, onSuccess: (details: any) => void, onError: (error: any) => void): Promise<void> {
    try {
      await this.loadPayPalSDK();

      if (!window.paypal) {
        throw new Error('PayPal SDK not loaded');
      }

      // Wait a bit to ensure DOM is ready
      await new Promise(resolve => setTimeout(resolve, 100));

      // Check if container exists
      const container = document.getElementById(containerId);
      if (!container) {
        throw new Error(`PayPal container with ID ${containerId} not found`);
      }

      // Clear container
      container.innerHTML = '';

      const buttons = window.paypal.Buttons({
        style: {
          layout: 'vertical',
          color: 'gold',
          shape: 'rect',
          label: 'paypal',
          height: 45,
          tagline: false
        },
        createOrder: () => {
          // For sandbox, we'll create a simple order without backend
          return window.paypal.order.create({
            purchase_units: [{
              amount: {
                value: '9.99',
                currency_code: 'USD'
              },
              description: 'ModelMix Pro Plan - Monthly Subscription'
            }]
          });
        },
        onApprove: async (data: any, actions: any) => {
          try {
            const order = await actions.order.capture();
            onSuccess({
              orderID: data.orderID,
              order,
              paymentID: order.purchase_units[0]?.payments?.captures[0]?.id
            });
          } catch (error) {
            console.error('Error capturing order:', error);
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
      });

      // Render the buttons
      await buttons.render(`#${containerId}`);
    } catch (error) {
      console.error('Failed to initialize PayPal buttons:', error);
      throw error;
    }
  }

  // Validate PayPal configuration
  isConfigured(): boolean {
    return !!(this.clientId && this.clientId.trim() !== '' && this.clientId !== 'your-paypal-client-id');
  }

  // Get environment info
  getEnvironmentInfo() {
    return {
      environment: this.environment,
      clientId: this.clientId ? `${this.clientId.substring(0, 10)}...` : 'Not set',
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