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
      // Add subscription support to the SDK
      script.src = `https://www.paypal.com/sdk/js?client-id=${this.clientId}&currency=USD&intent=subscription&vault=true&disable-funding=credit,card`;
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
  async initializePayPalButtons(
    containerId: string, 
    onSuccess: (details: any) => void, 
    onError: (error: any) => void,
    isRecurring: boolean = false
  ): Promise<void> {
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
          if (isRecurring) {
            // For recurring payments, create a subscription
            return actions.subscription.create({
              plan_id: this.getSubscriptionPlanId(), // You'll need to create this plan in PayPal
              application_context: {
                brand_name: 'ModelMix',
                locale: 'en-US',
                shipping_preference: 'NO_SHIPPING',
                user_action: 'SUBSCRIBE_NOW'
              }
            });
          } else {
            // For one-time payments
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
          }
        },
        onApprove: async (data: any, actions: any) => {
          try {
            if (isRecurring) {
              // For subscriptions, the subscription is automatically activated
              const subscription = await actions.subscription.get();
              onSuccess({
                subscriptionID: data.subscriptionID,
                subscription,
                orderID: data.orderID
              });
            } else {
              // For one-time payments
              const order = await actions.order.capture();
              onSuccess({
                orderID: data.orderID,
                order,
                paymentID: order.purchase_units[0]?.payments?.captures[0]?.id
              });
            }
          } catch (error) {
            console.error('Error processing payment:', error);
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

  // Get subscription plan ID (you'll need to create this in PayPal Dashboard)
  private getSubscriptionPlanId(): string {
    // For sandbox, you'll need to create a subscription plan in PayPal Dashboard
    // and replace this with the actual plan ID
    if (this.environment === 'production') {
      return 'P-XXXXXXXXXXXXXXXXXXXX'; // Replace with your production plan ID
    } else {
      return 'P-XXXXXXXXXXXXXXXXXXXX'; // Replace with your sandbox plan ID
    }
  }

  // Create a subscription plan (this would typically be done server-side)
  async createSubscriptionPlan(): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/billing/plans`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await this.getAccessToken()}`,
          'PayPal-Request-Id': `plan-${Date.now()}`
        },
        body: JSON.stringify({
          product_id: await this.createProduct(),
          name: 'ModelMix Pro Monthly',
          description: 'Monthly subscription for ModelMix Pro features',
          status: 'ACTIVE',
          billing_cycles: [{
            frequency: {
              interval_unit: 'MONTH',
              interval_count: 1
            },
            tenure_type: 'REGULAR',
            sequence: 1,
            total_cycles: 0, // 0 means infinite
            pricing_scheme: {
              fixed_price: {
                value: '9.99',
                currency_code: 'USD'
              }
            }
          }],
          payment_preferences: {
            auto_bill_outstanding: true,
            setup_fee: {
              value: '0',
              currency_code: 'USD'
            },
            setup_fee_failure_action: 'CONTINUE',
            payment_failure_threshold: 3
          },
          taxes: {
            percentage: '0',
            inclusive: false
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to create subscription plan: ${response.status}`);
      }

      const plan = await response.json();
      return plan.id;
    } catch (error) {
      console.error('Error creating subscription plan:', error);
      throw error;
    }
  }

  // Create a product (required for subscription plans)
  private async createProduct(): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/catalogs/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await this.getAccessToken()}`,
          'PayPal-Request-Id': `product-${Date.now()}`
        },
        body: JSON.stringify({
          name: 'ModelMix Pro',
          description: 'ModelMix Pro subscription with unlimited AI model access',
          type: 'SERVICE',
          category: 'SOFTWARE'
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to create product: ${response.status}`);
      }

      const product = await response.json();
      return product.id;
    } catch (error) {
      console.error('Error creating product:', error);
      throw error;
    }
  }

  // Get access token for PayPal API calls
  private async getAccessToken(): Promise<string> {
    const clientSecret = import.meta.env.VITE_PAYPAL_CLIENT_SECRET;
    if (!clientSecret) {
      throw new Error('PayPal client secret not configured');
    }

    const response = await fetch(`${this.baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${btoa(`${this.clientId}:${clientSecret}`)}`
      },
      body: 'grant_type=client_credentials'
    });

    if (!response.ok) {
      throw new Error(`Failed to get access token: ${response.status}`);
    }

    const data = await response.json();
    return data.access_token;
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