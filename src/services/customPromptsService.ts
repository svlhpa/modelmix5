import { supabase } from '../lib/supabase';
import { CustomPrompt } from '../types';

class CustomPromptsService {
  async loadCustomPrompts(): Promise<CustomPrompt[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    try {
      const { data, error } = await supabase
        .from('user_api_settings')
        .select('api_key')
        .eq('user_id', user.id)
        .eq('provider', 'custom_prompts')
        .maybeSingle();

      if (error || !data) {
        // Return empty array if no custom prompts found
        return [];
      }

      const customPrompts = JSON.parse(data.api_key) as CustomPrompt[];
      
      // Ensure all prompts have required properties
      return customPrompts.map(prompt => ({
        ...prompt,
        createdAt: new Date(prompt.createdAt),
        updatedAt: new Date(prompt.updatedAt)
      }));
    } catch (error) {
      console.error('Failed to load custom prompts:', error);
      return [];
    }
  }

  async saveCustomPrompts(prompts: CustomPrompt[]): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { error } = await supabase
      .from('user_api_settings')
      .upsert({
        user_id: user.id,
        provider: 'custom_prompts',
        api_key: JSON.stringify(prompts),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,provider'
      });

    if (error) throw error;
  }

  async createPrompt(title: string, content: string, category: string = 'Custom'): Promise<CustomPrompt> {
    const prompts = await this.loadCustomPrompts();
    
    const newPrompt: CustomPrompt = {
      id: `prompt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title,
      content,
      isActive: false,
      category,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const updatedPrompts = [...prompts, newPrompt];
    await this.saveCustomPrompts(updatedPrompts);
    
    return newPrompt;
  }

  async updatePrompt(id: string, updates: Partial<Omit<CustomPrompt, 'id' | 'createdAt'>>): Promise<void> {
    const prompts = await this.loadCustomPrompts();
    const promptIndex = prompts.findIndex(p => p.id === id);
    
    if (promptIndex === -1) {
      throw new Error('Prompt not found');
    }

    prompts[promptIndex] = {
      ...prompts[promptIndex],
      ...updates,
      updatedAt: new Date()
    };

    await this.saveCustomPrompts(prompts);
  }

  async deletePrompt(id: string): Promise<void> {
    const prompts = await this.loadCustomPrompts();
    const filteredPrompts = prompts.filter(p => p.id !== id);
    await this.saveCustomPrompts(filteredPrompts);
  }

  async setActivePrompt(id: string | null): Promise<void> {
    const prompts = await this.loadCustomPrompts();
    
    // Deactivate all prompts first
    const updatedPrompts = prompts.map(prompt => ({
      ...prompt,
      isActive: false,
      updatedAt: new Date()
    }));

    // Activate the selected prompt if id is provided
    if (id) {
      const promptIndex = updatedPrompts.findIndex(p => p.id === id);
      if (promptIndex !== -1) {
        updatedPrompts[promptIndex].isActive = true;
      }
    }

    await this.saveCustomPrompts(updatedPrompts);
  }

  getActivePrompt(prompts: CustomPrompt[]): CustomPrompt | null {
    return prompts.find(prompt => prompt.isActive) || null;
  }

  getPromptsByCategory(prompts: CustomPrompt[]): Record<string, CustomPrompt[]> {
    const categories: Record<string, CustomPrompt[]> = {};
    
    prompts.forEach(prompt => {
      if (!categories[prompt.category]) {
        categories[prompt.category] = [];
      }
      categories[prompt.category].push(prompt);
    });

    return categories;
  }

  // Get prompt categories for filtering
  getCategories(prompts: CustomPrompt[]): string[] {
    const categories = new Set(prompts.map(p => p.category));
    return Array.from(categories).sort();
  }
}

export const customPromptsService = new CustomPromptsService();