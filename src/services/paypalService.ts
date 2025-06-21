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
  private initializationPromise: Promise<void> | null = null;
  private activeContainers: Set<string> = new Set();
  private renderingContainers: Set<string> = new Set();

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
    // Return existing promise if already loading
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    // Check if PayPal SDK is already loaded
    if (window.paypal && this.sdkLoaded) {
      console.log('PayPal SDK already loaded');
      return Promise.resolve();
    }

    // Create new initialization promise
    this.initializationPromise = new Promise((resolve, reject) => {
      this.sdkLoading = true;

      // Remove existing script if any
      const existingScript = document.querySelector('script[src*="paypal.com/sdk/js"]');
      if (existingScript) {
        console.log('Removing existing PayPal script');
        existingScript.remove();
        // Reset state
        this.sdkLoaded = false;
        window.paypal = undefined;
      }

      const script = document.createElement('script');
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
            this.sdkLoaded = false;
            reject(new Error('PayPal Buttons API not available'));
          }
        }, 1000);
      };
      
      script.onerror = (error) => {
        console.error('Failed to load PayPal SDK:', error);
        this.sdkLoading = false;
        this.sdkLoaded = false;
        reject(new Error('Failed to load PayPal SDK'));
      };
      
      console.log('Loading PayPal SDK with URL:', script.src);
      document.head.appendChild(script);
    });

    this.initializationPromise.finally(() => {
      this.initializationPromise = null;
    });

    return this.initializationPromise;
  }

  // Initialize PayPal buttons with improved error handling
  async initializePayPalButtons(
    containerId: string, 
    onSuccess: (details: any) => void, 
    onError: (error: any) => void,
    isRecurring: boolean = false
  ): Promise<void> {
    try {
      console.log('Starting PayPal button initialization for container:', containerId);
      
      // Check if already rendering this container
      if (this.renderingContainers.has(containerId)) {
        throw new Error('Container is already being rendered');
      }

      // Track this container
      this.activeContainers.add(containerId);
      this.renderingContainers.add(containerId);
      
      await this.loadPayPalSDK();

      if (!window.paypal) {
        throw new Error('PayPal SDK not loaded');
      }

      if (!window.paypal.Buttons) {
        throw new Error('PayPal Buttons API not available');
      }

      // Comprehensive container verification
      const verifyContainer = () => {
        const container = document.getElementById(containerId);
        if (!container) {
          throw new Error(`Container with ID ${containerId} not found`);
        }
        if (!document.contains(container)) {
          throw new Error(`Container with ID ${containerId} is not in the DOM`);
        }
        if (container.offsetParent === null && container.style.display !== 'none') {
          throw new Error(`Container with ID ${containerId} is not visible`);
        }
        return container;
      };

      // Wait for container to be ready with retries
      let container: HTMLElement | null = null;
      let retries = 0;
      const maxRetries = 20;

      while (!container && retries < maxRetries) {
        try {
          container = verifyContainer();
          break;
        } catch (error) {
          console.log(`Container verification attempt ${retries + 1}/${maxRetries}: ${error.message}`);
          await new Promise(resolve => setTimeout(resolve, 150));
          retries++;
        }
      }

      if (!container) {
        throw new Error(`Container verification failed after ${maxRetries} attempts`);
      }

      // Clear container and ensure it's ready
      container.innerHTML = '';
      
      // Wait for DOM to stabilize
      await new Promise(resolve => setTimeout(resolve, 300));

      // Final container check before rendering
      const finalContainer = verifyContainer();
      console.log('Container verified, creating PayPal buttons...');

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

      // Render with comprehensive error handling
      try {
        console.log('Rendering PayPal buttons to container:', containerId);
        
        // Verify container one more time before rendering
        const renderContainer = document.getElementById(containerId);
        if (!renderContainer) {
          throw new Error('Container was removed before rendering');
        }

        // Use Promise-based rendering with timeout
        await Promise.race([
          buttons.render(`#${containerId}`),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('PayPal render timeout')), 10000)
          )
        ]);

        console.log('PayPal buttons render completed');
        
        // Verify buttons were actually rendered
        await new Promise<void>((resolve, reject) => {
          setTimeout(() => {
            const verifyContainer = document.getElementById(containerId);
            if (!verifyContainer) {
              reject(new Error('Container was removed after rendering'));
              return;
            }
            
            if (verifyContainer.children.length === 0) {
              reject(new Error('PayPal buttons container is empty after render'));
              return;
            }
            
            console.log('PayPal buttons successfully verified in container');
            resolve();
          }, 1000);
        });
        
      } catch (renderError) {
        console.error('PayPal render error:', renderError);
        throw new Error(`Failed to render PayPal buttons: ${renderError.message}`);
      } finally {
        this.renderingContainers.delete(containerId);
      }
    } catch (error) {
      console.error('Failed to initialize PayPal buttons:', error);
      // Clean up on error
      this.activeContainers.delete(containerId);
      this.renderingContainers.delete(containerId);
      throw error;
    }
  }

  // Clean up container tracking
  cleanupContainer(containerId: string): void {
    this.activeContainers.delete(containerId);
    this.renderingContainers.delete(containerId);
    const container = document.getElementById(containerId);
    if (container) {
      container.innerHTML = '';
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
      sdkLoading: this.sdkLoading,
      activeContainers: Array.from(this.activeContainers),
      renderingContainers: Array.from(this.renderingContainers)
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