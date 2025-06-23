interface PayPalOrderResponse {
  id: string;
  status: string;
  links: Array<{
    href: string;
    rel: string;
    method: string;
  }>;
}

interface PayPalSubscriptionResponse {
  id: string;
  status: string;
  status_update_time: string;
  plan_id: string;
  start_time: string;
  subscriber: any;
  billing_info: any;
  links: Array<{
    href: string;
    rel: string;
    method: string;
  }>;
}

class PayPalService {
  private clientId: string;
  private clientSecret: string;
  private environment: 'sandbox' | 'production';
  private baseUrl: string;
  private sdkLoaded: boolean = false;
  private subscriptionPlanId: string = 'P-2A58044182497992VNBMPFYI'; // Your production plan ID

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
      baseUrl: this.baseUrl,
      planId: this.subscriptionPlanId
    });
  }

  // Load PayPal SDK dynamically with subscription support
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
      
      // CRITICAL: Use subscription intent with vault=true for recurring payments
      script.src = `https://www.paypal.com/sdk/js?client-id=${this.clientId}&vault=true&intent=subscription&disable-funding=credit,card`;
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

  // Initialize PayPal buttons with subscription support
  async initializePayPalButtons(
    containerId: string, 
    onSuccess: (details: any) => void, 
    onError: (error: any) => void,
    isRecurring: boolean = true // Changed to true for subscriptions
  ): Promise<void> {
    try {
      console.log('Initializing PayPal subscription buttons for container:', containerId);
      
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
      console.log('Container cleared, creating PayPal subscription buttons');

      const buttons = window.paypal.Buttons({
        style: {
          shape: 'rect',
          color: 'gold',
          layout: 'vertical',
          label: 'subscribe',
          height: 45,
          tagline: false
        },
        
        createSubscription: (data: any, actions: any) => {
          console.log('Creating PayPal subscription with plan ID:', this.subscriptionPlanId);
          
          return actions.subscription.create({
            plan_id: this.subscriptionPlanId,
            application_context: {
              brand_name: 'ModelMix',
              locale: 'en-US',
              shipping_preference: 'NO_SHIPPING',
              user_action: 'SUBSCRIBE_NOW'
            }
          });
        },
        
        onApprove: async (data: any, actions: any) => {
          try {
            console.log('PayPal subscription approved:', data);
            
            // Get subscription details
            const subscription = await actions.subscription.get();
            console.log('Subscription details:', subscription);
            
            onSuccess({
              subscriptionID: data.subscriptionID,
              subscription,
              orderID: data.orderID,
              environment: this.environment,
              planId: this.subscriptionPlanId
            });
            
          } catch (error) {
            console.error('Error processing subscription:', error);
            onError(error);
          }
        },
        
        onError: (error: any) => {
          console.error('PayPal subscription error:', error);
          onError(error);
        },
        
        onCancel: (data: any) => {
          console.log('PayPal subscription cancelled:', data);
          onError(new Error('Subscription was cancelled by user'));
        }
      });

      // Render the buttons
      console.log('Rendering PayPal subscription buttons...');
      await buttons.render(`#${containerId}`);
      console.log('PayPal subscription buttons rendered successfully');
      
    } catch (error) {
      console.error('Failed to initialize PayPal subscription buttons:', error);
      throw error;
    }
  }

  // Get subscription plan ID
  getSubscriptionPlanId(): string {
    return this.subscriptionPlanId;
  }

  // Get subscription details
  async getSubscriptionDetails(subscriptionId: string): Promise<PayPalSubscriptionResponse> {
    try {
      const accessToken = await this.getAccessToken();
      
      const response = await fetch(`${this.baseUrl}/v1/billing/subscriptions/${subscriptionId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to get subscription details: ${response.status} - ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting subscription details:', error);
      throw error;
    }
  }

  // Cancel subscription
  async cancelSubscription(subscriptionId: string, reason: string = 'User requested cancellation'): Promise<void> {
    try {
      const accessToken = await this.getAccessToken();
      
      const response = await fetch(`${this.baseUrl}/v1/billing/subscriptions/${subscriptionId}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          reason: reason
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to cancel subscription: ${response.status} - ${errorText}`);
      }

      console.log('Subscription cancelled successfully');
    } catch (error) {
      console.error('Error cancelling subscription:', error);
      throw error;
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
      planId: this.subscriptionPlanId,
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
      baseUrl: this.baseUrl,
      planId: this.subscriptionPlanId
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

  // Verify subscription plan exists
  async verifySubscriptionPlan(): Promise<boolean> {
    try {
      const accessToken = await this.getAccessToken();
      
      const response = await fetch(`${this.baseUrl}/v1/billing/plans/${this.subscriptionPlanId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (response.ok) {
        const plan = await response.json();
        console.log('Subscription plan verified:', plan.name);
        return true;
      } else {
        console.error('Subscription plan not found:', response.status);
        return false;
      }
    } catch (error) {
      console.error('Error verifying subscription plan:', error);
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