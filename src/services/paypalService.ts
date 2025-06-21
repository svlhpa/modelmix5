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
        // Add a small delay to ensure PayPal SDK is fully initialized
        setTimeout(() => resolve(), 500);
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

      // Wait a bit more to ensure DOM is ready
      await new Promise(resolve => setTimeout(resolve, 300));

      // Check if container exists
      const container = document.getElementById(containerId);
      if (!container) {
        throw new Error(`PayPal container with ID ${containerId} not found`);
      }

      // Clear container
      container.innerHTML = '';

      // Verify PayPal Buttons API is available
      if (!window.paypal.Buttons) {
        throw new Error('PayPal Buttons API not available');
      }

      const buttons = window.paypal.Buttons({
        style: {
          layout: 'vertical',
          color: 'gold',
          shape: 'rect',
          label: 'paypal',
          height: 45,
          tagline: false
        },
        createOrder: (data: any, actions: any) => {
          // Use the actions.order.create method properly
          return actions.order.create({
            purchase_units: [{
              amount: {
                value: '9.99',
                currency_code: 'USD'
              },
              description: 'ModelMix Pro Plan - Monthly Subscription'
            }],
            application_context: {
              brand_name: 'ModelMix',
              landing_page: 'NO_PREFERENCE',
              user_action: 'PAY_NOW'
            }
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

      // Render the buttons with error handling
      try {
        await buttons.render(`#${containerId}`);
      } catch (renderError) {
        console.error('PayPal render error:', renderError);
        throw new Error('Failed to render PayPal buttons');
      }
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