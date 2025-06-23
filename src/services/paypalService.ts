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
  private clientSecret: string;
  private environment: 'sandbox' | 'production';
  private baseUrl: string;
  private sdkLoaded: boolean = false;

  constructor() {
    // Use environment variables for production
    this.clientId = import.meta.env.VITE_PAYPAL_CLIENT_ID || '';
    this.clientSecret = import.meta.env.VITE_PAYPAL_CLIENT_SECRET || '';
    this.environment = import.meta.env.VITE_PAYPAL_ENVIRONMENT === 'production' ? 'production' : 'sandbox';
    this.baseUrl = this.environment === 'production' 
      ? 'https://api-m.paypal.com' 
      : 'https://api-m.sandbox.paypal.com';

    console.log('PayPal Service initialized:', {
      environment: this.environment,
      clientId: this.clientId ? `${this.clientId.substring(0, 10)}...` : 'Not set',
      baseUrl: this.baseUrl
    });
  }

  // Load PayPal SDK dynamically with proper configuration
  async loadPayPalSDK(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Check if PayPal SDK is already loaded
      if (window.paypal && this.sdkLoaded) {
        console.log('PayPal SDK already loaded');
        resolve();
        return;
      }

      // Remove existing script if any
      const existingScript = document.querySelector('script[src*="paypal.com/sdk/js"]');
      if (existingScript) {
        console.log('Removing existing PayPal script');
        existingScript.remove();
      }

      const script = document.createElement('script');
      
      // CRITICAL: Use a working subscription plan ID for production
      // For now, we'll use one-time payments instead of subscriptions to avoid plan ID issues
      script.src = `https://www.paypal.com/sdk/js?client-id=${this.clientId}&currency=USD&intent=capture&disable-funding=credit,card`;
      script.async = true;
      
      script.onload = () => {
        this.sdkLoaded = true;
        console.log('PayPal SDK loaded successfully for', this.environment);
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
        reject(new Error('Failed to load PayPal SDK'));
      };
      
      document.head.appendChild(script);
    });
  }

  // Initialize PayPal buttons with simplified approach
  async initializePayPalButtons(
    containerId: string, 
    onSuccess: (details: any) => void, 
    onError: (error: any) => void,
    isRecurring: boolean = false // Changed to false for one-time payments
  ): Promise<void> {
    try {
      console.log('Initializing PayPal buttons for container:', containerId);
      
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
      console.log('Container cleared, creating PayPal buttons');

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
          
          // Use one-time payment for now (easier to set up than subscriptions)
          return actions.order.create({
            purchase_units: [{
              amount: {
                value: '17.99',
                currency_code: 'USD'
              },
              description: 'ModelMix Pro Plan - Monthly Access'
            }],
            application_context: {
              brand_name: 'ModelMix',
              landing_page: 'NO_PREFERENCE',
              user_action: 'PAY_NOW',
              shipping_preference: 'NO_SHIPPING'
            }
          });
        },
        
        onApprove: async (data: any, actions: any) => {
          try {
            console.log('PayPal payment approved, capturing order...', data);
            
            const order = await actions.order.capture();
            console.log('Order captured successfully:', order);
            
            onSuccess({
              orderID: data.orderID,
              order,
              paymentID: order.purchase_units[0]?.payments?.captures[0]?.id,
              environment: this.environment,
              amount: order.purchase_units[0]?.payments?.captures[0]?.amount
            });
            
          } catch (error) {
            console.error('Error capturing payment:', error);
            onError(error);
          }
        },
        
        onError: (error: any) => {
          console.error('PayPal button error:', error);
          onError(error);
        },
        
        onCancel: (data: any) => {
          console.log('PayPal payment cancelled:', data);
          onError(new Error('Payment was cancelled by user'));
        }
      });

      // Render the buttons
      console.log('Rendering PayPal buttons...');
      await buttons.render(`#${containerId}`);
      console.log('PayPal buttons rendered successfully');
      
    } catch (error) {
      console.error('Failed to initialize PayPal buttons:', error);
      throw error;
    }
  }

  // Get subscription plan ID (not used for now, but kept for future)
  private getSubscriptionPlanId(): string {
    if (this.environment === 'production') {
      // You would need to create this in your PayPal Business Dashboard
      return 'P-YOUR_PRODUCTION_PLAN_ID';
    } else {
      return 'P-YOUR_SANDBOX_PLAN_ID';
    }
  }

  // Get access token for PayPal API calls
  private async getAccessToken(): Promise<string> {
    if (!this.clientSecret) {
      throw new Error('PayPal client secret not configured');
    }

    try {
      const response = await fetch(`${this.baseUrl}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${btoa(`${this.clientId}:${this.clientSecret}`)}`
        },
        body: 'grant_type=client_credentials'
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('PayPal token error:', errorText);
        throw new Error(`Failed to get access token: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      return data.access_token;
    } catch (error) {
      console.error('Error getting PayPal access token:', error);
      throw error;
    }
  }

  // Validate PayPal configuration
  isConfigured(): boolean {
    const isValid = !!(this.clientId && this.clientId.trim() !== '' && 
                      this.clientSecret && this.clientSecret.trim() !== '');
    
    console.log('PayPal configuration check:', {
      hasClientId: !!this.clientId,
      hasClientSecret: !!this.clientSecret,
      environment: this.environment,
      isValid
    });
    
    return isValid;
  }

  // Get environment info
  getEnvironmentInfo() {
    return {
      environment: this.environment,
      clientId: this.clientId ? `${this.clientId.substring(0, 10)}...` : 'Not set',
      configured: this.isConfigured(),
      baseUrl: this.baseUrl
    };
  }

  // Test API connection
  async testConnection(): Promise<boolean> {
    try {
      console.log('Testing PayPal API connection...');
      const token = await this.getAccessToken();
      console.log('PayPal connection test successful');
      return !!token;
    } catch (error) {
      console.error('PayPal connection test failed:', error);
      return false;
    }
  }
}

// Extend window interface for PayPal SDK
declare global {
  interface Window {
    paypal?: any;
  }
}

export const paypalService = new PayPalService();