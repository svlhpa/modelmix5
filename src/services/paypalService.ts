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
  private sdkLoading: boolean = false;

  constructor() {
    // Use environment variables or default to sandbox
    this.clientId = import.meta.env.VITE_PAYPAL_CLIENT_ID || '';
    this.environment = import.meta.env.VITE_PAYPAL_ENVIRONMENT === 'production' ? 'production' : 'sandbox';
    this.baseUrl = this.environment === 'production' 
      ? 'https://api-m.paypal.com' 
      : 'https://api-m.sandbox.paypal.com';
  }

  // Load PayPal SDK dynamically with better error handling
  async loadPayPalSDK(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Check if PayPal SDK is already loaded
      if (window.paypal && this.sdkLoaded) {
        console.log('PayPal SDK already loaded');
        resolve();
        return;
      }

      // Prevent multiple simultaneous loads
      if (this.sdkLoading) {
        console.log('PayPal SDK is already loading, waiting...');
        const checkLoaded = () => {
          if (this.sdkLoaded) {
            resolve();
          } else {
            setTimeout(checkLoaded, 100);
          }
        };
        checkLoaded();
        return;
      }

      this.sdkLoading = true;

      // Remove existing script if any
      const existingScript = document.querySelector('script[src*="paypal.com/sdk/js"]');
      if (existingScript) {
        console.log('Removing existing PayPal script');
        existingScript.remove();
      }

      const script = document.createElement('script');
      // Simplified SDK loading - remove subscription for now to test basic functionality
      script.src = `https://www.paypal.com/sdk/js?client-id=${this.clientId}&currency=USD&intent=capture&disable-funding=credit,card`;
      script.async = true;
      
      script.onload = () => {
        console.log('PayPal SDK loaded successfully');
        this.sdkLoaded = true;
        this.sdkLoading = false;
        // Add a delay to ensure PayPal SDK is fully initialized
        setTimeout(() => {
          if (window.paypal && window.paypal.Buttons) {
            console.log('PayPal Buttons API is available');
            resolve();
          } else {
            console.error('PayPal Buttons API not available after load');
            reject(new Error('PayPal Buttons API not available'));
          }
        }, 1000);
      };
      
      script.onerror = (error) => {
        console.error('Failed to load PayPal SDK:', error);
        this.sdkLoading = false;
        reject(new Error('Failed to load PayPal SDK'));
      };
      
      console.log('Loading PayPal SDK with URL:', script.src);
      document.head.appendChild(script);
    });
  }

  // Initialize PayPal buttons with improved error handling
  async initializePayPalButtons(
    containerId: string, 
    onSuccess: (details: any) => void, 
    onError: (error: any) => void,
    isRecurring: boolean = false
  ): Promise<void> {
    try {
      console.log('Starting PayPal button initialization...');
      
      await this.loadPayPalSDK();

      if (!window.paypal) {
        throw new Error('PayPal SDK not loaded');
      }

      if (!window.paypal.Buttons) {
        throw new Error('PayPal Buttons API not available');
      }

      // Wait for DOM to be ready
      await new Promise(resolve => setTimeout(resolve, 500));

      // Check if container exists
      const container = document.getElementById(containerId);
      if (!container) {
        throw new Error(`PayPal container with ID ${containerId} not found`);
      }

      // Clear container
      container.innerHTML = '';
      console.log('PayPal container cleared, initializing buttons...');

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
          console.log('Creating PayPal order...');
          // For now, use simple one-time payment instead of subscription
          return actions.order.create({
            purchase_units: [{
              amount: {
                value: '18.00',
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
            console.log('PayPal payment approved, capturing order...');
            const order = await actions.order.capture();
            console.log('Order captured successfully:', order);
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
        console.log('Rendering PayPal buttons...');
        await buttons.render(`#${containerId}`);
        console.log('PayPal buttons rendered successfully');
      } catch (renderError) {
        console.error('PayPal render error:', renderError);
        throw new Error(`Failed to render PayPal buttons: ${renderError.message}`);
      }
    } catch (error) {
      console.error('Failed to initialize PayPal buttons:', error);
      throw error;
    }
  }

  // Validate PayPal configuration
  isConfigured(): boolean {
    const configured = !!(this.clientId && this.clientId.trim() !== '' && this.clientId !== 'your-paypal-client-id');
    console.log('PayPal configuration check:', {
      hasClientId: !!this.clientId,
      clientIdLength: this.clientId?.length,
      configured
    });
    return configured;
  }

  // Get environment info for debugging
  getEnvironmentInfo() {
    return {
      environment: this.environment,
      clientId: this.clientId ? `${this.clientId.substring(0, 10)}...` : 'Not set',
      configured: this.isConfigured(),
      sdkLoaded: this.sdkLoaded,
      sdkLoading: this.sdkLoading
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