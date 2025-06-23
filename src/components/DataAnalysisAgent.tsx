import React, { useState, useEffect, useRef } from 'react';
import { X, BarChart3, Brain, CheckCircle, AlertCircle, Clock, Play, Pause, Download, Eye, Edit, RotateCcw, Zap, Target, Users, Shield, DollarSign, BookOpen, FileCheck, Layers, Globe, ChevronDown, ChevronUp, Bot, Network, FileText, PieChart, LineChart, BarChart, Table, ArrowRight } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { picaosService } from '../services/picaosService';

interface DataAnalysisAgentProps {
  isOpen: boolean;
  onClose: () => void;
}

interface AnalysisProject {
  id: string;
  title: string;
  description: string;
  status: 'planning' | 'cleaning' | 'analyzing' | 'visualizing' | 'completed' | 'error';
  progress: number;
  datasetInfo: {
    rows: number;
    columns: number;
    dataTypes: string[];
    sampleData: any[];
  };
  insights: AnalysisInsight[];
  visualizations: AnalysisVisualization[];
  summary: string;
  createdAt: Date;
  updatedAt: Date;
}

interface AnalysisInsight {
  id: string;
  title: string;
  description: string;
  confidence: number;
  category: string;
  model: string;
}

interface AnalysisVisualization {
  id: string;
  title: string;
  type: 'bar' | 'line' | 'pie' | 'scatter' | 'table';
  description: string;
  imageUrl?: string;
  data?: any;
}

export const DataAnalysisAgent: React.FC<DataAnalysisAgentProps> = ({ isOpen, onClose }) => {
  const { user, getCurrentTier } = useAuth();
  const [step, setStep] = useState<'setup' | 'analyzing' | 'completed'>('setup');
  const [dataDescription, setDataDescription] = useState('');
  const [analysisGoal, setAnalysisGoal] = useState('');
  const [dataFormat, setDataFormat] = useState<'csv' | 'json' | 'excel' | 'text'>('csv');
  const [includeVisualization, setIncludeVisualization] = useState(true);
  const [includeRecommendations, setIncludeRecommendations] = useState(true);
  const [currentProject, setCurrentProject] = useState<AnalysisProject | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [expandedInsights, setExpandedInsights] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const currentTier = getCurrentTier();
  const isProUser = currentTier === 'tier2';

  useEffect(() => {
    if (isOpen) {
      checkPicaosConnection();
    }
  }, [isOpen]);

  useEffect(() => {
    scrollToBottom();
  }, [currentProject?.insights]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const checkPicaosConnection = async () => {
    setConnectionStatus('checking');
    try {
      const isConnected = await picaosService.testConnection(currentTier);
      setConnectionStatus(isConnected ? 'connected' : 'disconnected');
    } catch (error) {
      console.error('PicaOS connection check failed:', error);
      setConnectionStatus('disconnected');
    }
  };

  const handleStartAnalysis = async () => {
    if (!user) {
      setError('Please sign in to use Data Analysis Agent');
      return;
    }

    if (!dataDescription.trim()) {
      setError('Please enter a description of your dataset');
      return;
    }

    if (!analysisGoal.trim()) {
      setError('Please enter your analysis goal');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setStep('analyzing');

    try {
      // Initialize a new analysis project
      const project: AnalysisProject = {
        id: `analysis-${Date.now()}`,
        title: `Analysis of ${dataDescription.split(' ').slice(0, 5).join(' ')}`,
        description: dataDescription.trim(),
        status: 'planning',
        progress: 0,
        datasetInfo: {
          rows: Math.floor(Math.random() * 5000) + 1000,
          columns: Math.floor(Math.random() * 20) + 5,
          dataTypes: ['numeric', 'categorical', 'datetime', 'text'],
          sampleData: []
        },
        insights: [],
        visualizations: [],
        summary: '',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      setCurrentProject(project);
      
      // Simulate the analysis process
      await simulateAnalysis(project);
      
    } catch (error) {
      console.error('Analysis process failed:', error);
      setError(error instanceof Error ? error.message : 'Analysis process failed');
      if (currentProject) {
        currentProject.status = 'error';
        setCurrentProject({...currentProject});
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const simulateAnalysis = async (project: AnalysisProject) => {
    // Step 1: Planning phase
    project.status = 'planning';
    project.progress = 5;
    setCurrentProject({...project});
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Step 2: Data cleaning
    project.status = 'cleaning';
    project.progress = 20;
    setCurrentProject({...project});
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Step 3: Analysis phase
    project.status = 'analyzing';
    project.progress = 40;
    
    // Generate initial insights
    const initialInsights = [
      {
        id: `insight-${Date.now()}-1`,
        title: 'Key Trend Identified',
        description: `Analysis of the ${dataDescription} dataset reveals a significant trend in the data. There appears to be a strong correlation between variables A and B, with a Pearson correlation coefficient of 0.78 (p < 0.001). This suggests that as variable A increases, variable B tends to increase as well, which has important implications for ${analysisGoal}.`,
        confidence: 0.92,
        category: 'Trend Analysis',
        model: 'Statistical Analysis Agent'
      },
      {
        id: `insight-${Date.now()}-2`,
        title: 'Data Distribution Findings',
        description: `The distribution of values in the primary metric shows a slight positive skew (skewness = 0.34), indicating that while most values cluster around the mean, there are some outliers pulling the distribution to the right. This is important to consider when interpreting averages and may suggest the need for non-parametric statistical methods for further analysis.`,
        confidence: 0.88,
        category: 'Statistical Analysis',
        model: 'Distribution Analysis Agent'
      }
    ];
    
    project.insights = initialInsights;
    setCurrentProject({...project});
    await new Promise(resolve => setTimeout(resolve, 4000));
    
    // Step 4: Add more insights
    project.progress = 60;
    
    const additionalInsights = [
      {
        id: `insight-${Date.now()}-3`,
        title: 'Segment Performance Comparison',
        description: `When segmenting the data by category, we observe that Segment C significantly outperforms other segments with a 27% higher performance metric (p < 0.01). This finding suggests that focusing resources on Segment C could yield the highest returns. Further analysis of the characteristics of this segment reveals that it has unique attributes including X, Y, and Z.`,
        confidence: 0.85,
        category: 'Segmentation Analysis',
        model: 'Clustering Agent'
      }
    ];
    
    project.insights = [...project.insights, ...additionalInsights];
    setCurrentProject({...project});
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Step 5: Visualization phase
    if (includeVisualization) {
      project.status = 'visualizing';
      project.progress = 80;
      
      const visualizations = [
        {
          id: `viz-${Date.now()}-1`,
          title: 'Trend Analysis Over Time',
          type: 'line' as const,
          description: 'This visualization shows the primary metric trending over time, with a clear upward trajectory in Q3 and Q4.',
          imageUrl: 'https://via.placeholder.com/600x400?text=Line+Chart+Visualization'
        },
        {
          id: `viz-${Date.now()}-2`,
          title: 'Segment Distribution',
          type: 'pie' as const,
          description: 'Breakdown of data by segment, highlighting the dominance of Segment C in the overall distribution.',
          imageUrl: 'https://via.placeholder.com/600x400?text=Pie+Chart+Visualization'
        },
        {
          id: `viz-${Date.now()}-3`,
          title: 'Correlation Matrix',
          type: 'table' as const,
          description: 'Heatmap showing correlations between key variables, with stronger correlations highlighted in darker colors.',
          imageUrl: 'https://via.placeholder.com/600x400?text=Correlation+Matrix+Visualization'
        }
      ];
      
      project.visualizations = visualizations;
      setCurrentProject({...project});
      await new Promise(resolve => setTimeout(resolve, 4000));
    }
    
    // Step 6: Generate summary with recommendations
    project.summary = generateMockSummary(project, includeRecommendations);
    project.status = 'completed';
    project.progress = 100;
    setCurrentProject({...project});
    setStep('completed');
  };

  const generateMockSummary = (project: AnalysisProject, includeRecommendations: boolean): string => {
    let summary = `# Analysis Summary: ${project.title}\n\n`;
    
    summary += `## Overview\n\n`;
    summary += `This analysis examined a dataset with ${project.datasetInfo.rows.toLocaleString()} rows and ${project.datasetInfo.columns} columns, focusing on ${project.description}. The primary goal was to ${analysisGoal}.\n\n`;
    
    summary += `## Key Findings\n\n`;
    project.insights.forEach((insight, index) => {
      summary += `### ${index + 1}. ${insight.title}\n`;
      summary += `${insight.description}\n\n`;
    });
    
    if (includeRecommendations) {
      summary += `## Recommendations\n\n`;
      summary += `1. **Strategic Focus**: Based on the performance of Segment C, consider reallocating resources to capitalize on this high-performing segment.\n\n`;
      summary += `2. **Further Investigation**: The correlation between variables A and B warrants deeper analysis to understand causality and potential applications.\n\n`;
      summary += `3. **Operational Adjustments**: Consider adjusting operational parameters to align with the patterns observed in the time-series analysis.\n\n`;
      summary += `4. **Data Collection**: Enhance data collection in areas where current data shows limitations, particularly regarding [specific aspect].\n\n`;
    }
    
    summary += `## Methodology\n\n`;
    summary += `This analysis was conducted using PicaOS multi-agent orchestration, employing specialized AI models for different aspects of the analysis process. The approach included data cleaning, statistical analysis, pattern recognition, and insight generation, with each step handled by a specialized agent optimized for that specific task.\n\n`;
    
    return summary;
  };

  const toggleInsightExpansion = (insightId: string) => {
    const newExpanded = new Set(expandedInsights);
    if (newExpanded.has(insightId)) {
      newExpanded.delete(insightId);
    } else {
      newExpanded.add(insightId);
    }
    setExpandedInsights(newExpanded);
  };

  const getVisualizationIcon = (type: string) => {
    switch (type) {
      case 'bar': return <BarChart size={16} className="text-green-600" />;
      case 'line': return <LineChart size={16} className="text-blue-600" />;
      case 'pie': return <PieChart size={16} className="text-purple-600" />;
      case 'table': return <Table size={16} className="text-orange-600" />;
      default: return <BarChart3 size={16} className="text-green-600" />;
    }
  };

  const handleExport = async (format: 'pdf' | 'docx' | 'txt') => {
    if (!currentProject) return;

    try {
      // In a real implementation, this would call an export service
      alert(`Exporting analysis in ${format.toUpperCase()} format`);
    } catch (error) {
      console.error('Failed to export analysis:', error);
      setError(error instanceof Error ? error.message : 'Failed to export analysis');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div className="bg-white rounded-xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden transform animate-slideUp">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-600 to-teal-600 text-white p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-white/20 rounded-lg animate-bounceIn">
                <BarChart3 size={24} />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Data Analysis Agent</h2>
                <p className="text-green-100">Multi-agent data analysis with PicaOS orchestration</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              {/* Connection Status */}
              <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm ${
                connectionStatus === 'connected' ? 'bg-green-500/20 text-green-100' :
                connectionStatus === 'disconnected' ? 'bg-red-500/20 text-red-100' :
                'bg-yellow-500/20 text-yellow-100'
              }`}>
                <div className={`w-2 h-2 rounded-full ${
                  connectionStatus === 'connected' ? 'bg-green-400' :
                  connectionStatus === 'disconnected' ? 'bg-red-400' :
                  'bg-yellow-400 animate-pulse'
                }`}></div>
                <span>
                  {connectionStatus === 'connected' ? 'PicaOS Connected' :
                   connectionStatus === 'disconnected' ? 'PicaOS Offline' :
                   'Checking...'}
                </span>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-white/20 transition-all duration-200 hover:scale-110"
                disabled={isGenerating}
              >
                <X size={24} />
              </button>
            </div>
          </div>

          {/* Progress Bar */}
          {currentProject && (
            <div className="mt-4">
              <div className="flex items-center justify-between text-sm mb-2">
                <span>{currentProject.title}</span>
                <div className="flex items-center space-x-4">
                  <span>{currentProject.progress}% Complete</span>
                  <span className="text-green-200">
                    {currentProject.insights.length} insights
                  </span>
                  <span className="text-green-200">
                    {currentProject.visualizations.length} visualizations
                  </span>
                </div>
              </div>
              <div className="w-full bg-white/20 rounded-full h-3 overflow-hidden">
                <div
                  className={`h-3 rounded-full transition-all duration-500 ease-out ${
                    currentProject.progress < 25 ? 'bg-red-500' :
                    currentProject.progress < 50 ? 'bg-orange-500' :
                    currentProject.progress < 75 ? 'bg-yellow-500' :
                    'bg-green-500'
                  }`}
                  style={{ width: `${currentProject.progress}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-xs mt-2 text-green-200">
                <span>Status: {currentProject.status}</span>
                {isGenerating && (
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                    <span>Analysis in progress...</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {step === 'setup' && (
            <div className="p-6 h-full overflow-y-auto">
              <div className="max-w-4xl mx-auto space-y-6">
                {/* Feature Overview */}
                <div className="bg-gradient-to-r from-green-50 to-teal-50 border border-green-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-green-800 mb-4 flex items-center space-x-2">
                    <Bot className="text-green-600" size={20} />
                    <span>PicaOS Data Analysis</span>
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div className="flex items-start space-x-3">
                      <Layers className="text-green-600 flex-shrink-0 mt-0.5" size={16} />
                      <div>
                        <p className="font-medium text-green-800">Data Cleaning</p>
                        <p className="text-green-700">Specialized agents handle data preparation</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <Brain className="text-green-600 flex-shrink-0 mt-0.5" size={16} />
                      <div>
                        <p className="font-medium text-green-800">Statistical Analysis</p>
                        <p className="text-green-700">Advanced statistical methods for deep insights</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <BarChart3 className="text-green-600 flex-shrink-0 mt-0.5" size={16} />
                      <div>
                        <p className="font-medium text-green-800">Visualization Planning</p>
                        <p className="text-green-700">Optimal visualization selection for your data</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <Network className="text-green-600 flex-shrink-0 mt-0.5" size={16} />
                      <div>
                        <p className="font-medium text-green-800">Multi-Agent Coordination</p>
                        <p className="text-green-700">Specialized agents work together on different analysis tasks</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Connection Status Alert */}
                {connectionStatus === 'disconnected' && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <div className="flex items-start space-x-3">
                      <AlertCircle className="text-amber-600 flex-shrink-0 mt-0.5" size={16} />
                      <div>
                        <h4 className="font-medium text-amber-800 mb-1">PicaOS Connection Required</h4>
                        <p className="text-sm text-amber-700 mb-3">
                          Data Analysis Agent requires a connection to PicaOS for multi-agent orchestration. The system will fall back to local processing if PicaOS is unavailable.
                        </p>
                        <button
                          onClick={checkPicaosConnection}
                          className="flex items-center space-x-2 px-3 py-1 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-sm"
                        >
                          <RefreshCw size={14} />
                          <span>Retry Connection</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Analysis Setup */}
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Analysis Configuration</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Dataset Description *
                      </label>
                      <textarea
                        value={dataDescription}
                        onChange={(e) => setDataDescription(e.target.value)}
                        placeholder="Describe your dataset (e.g., 'Customer purchase data for the last 12 months including demographics and transaction values')"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                        rows={3}
                        maxLength={1000}
                      />
                      <p className="text-xs text-gray-500 mt-1">{dataDescription.length}/1000 characters</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Analysis Goal *
                      </label>
                      <textarea
                        value={analysisGoal}
                        onChange={(e) => setAnalysisGoal(e.target.value)}
                        placeholder="What insights are you looking for? (e.g., 'Identify customer segments and purchase patterns to optimize marketing campaigns')"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                        rows={2}
                        maxLength={500}
                      />
                      <p className="text-xs text-gray-500 mt-1">{analysisGoal.length}/500 characters</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Data Format</label>
                        <select
                          value={dataFormat}
                          onChange={(e) => setDataFormat(e.target.value as any)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                        >
                          <option value="csv">CSV</option>
                          <option value="json">JSON</option>
                          <option value="excel">Excel</option>
                          <option value="text">Text/Tabular</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={includeVisualization}
                          onChange={(e) => setIncludeVisualization(e.target.checked)}
                          className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                        />
                        <span className="text-sm text-gray-700">Generate data visualizations</span>
                      </label>

                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={includeRecommendations}
                          onChange={(e) => setIncludeRecommendations(e.target.checked)}
                          className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                        />
                        <span className="text-sm text-gray-700">Include actionable recommendations</span>
                      </label>
                    </div>
                  </div>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-center space-x-2 text-red-700">
                      <AlertCircle size={16} />
                      <span className="text-sm">{error}</span>
                    </div>
                  </div>
                )}

                <div className="flex justify-end space-x-3">
                  <button
                    onClick={onClose}
                    className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                    disabled={isGenerating}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleStartAnalysis}
                    disabled={!dataDescription.trim() || !analysisGoal.trim() || isGenerating}
                    className="flex items-center space-x-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:scale-105 transform"
                  >
                    {isGenerating ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Initializing...</span>
                      </>
                    ) : (
                      <>
                        <BarChart3 size={16} />
                        <span>Start Analysis</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === 'analyzing' && currentProject && (
            <div className="h-full flex flex-col">
              {/* Project Info */}
              <div className="bg-gray-50 border-b border-gray-200 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">{currentProject.title}</h3>
                    <p className="text-sm text-gray-600">
                      {currentProject.datasetInfo.rows.toLocaleString()} rows • {currentProject.datasetInfo.columns} columns • {currentProject.status}
                    </p>
                  </div>
                </div>
              </div>

              {/* Analysis Progress */}
              <div className="flex-1 overflow-y-auto p-4">
                <div className="space-y-6">
                  {/* Dataset Info */}
                  <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <h4 className="text-lg font-medium text-gray-900 mb-3 flex items-center space-x-2">
                      <Table size={18} className="text-green-600" />
                      <span>Dataset Information</span>
                    </h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <p className="font-medium text-gray-700">Rows</p>
                        <p className="text-2xl font-bold text-green-600">{currentProject.datasetInfo.rows.toLocaleString()}</p>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <p className="font-medium text-gray-700">Columns</p>
                        <p className="text-2xl font-bold text-green-600">{currentProject.datasetInfo.columns}</p>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <p className="font-medium text-gray-700">Data Types</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {currentProject.datasetInfo.dataTypes.map((type, index) => (
                            <span key={index} className="px-2 py-0.5 bg-green-100 text-green-800 rounded-full text-xs">
                              {type}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Insights Section */}
                  {currentProject.insights.length > 0 && (
                    <div>
                      <h4 className="text-lg font-medium text-gray-900 mb-3 flex items-center space-x-2">
                        <Brain size={18} className="text-green-600" />
                        <span>Analysis Insights</span>
                        {isGenerating && currentProject.status === 'analyzing' && (
                          <span className="text-sm text-green-600 bg-green-100 px-2 py-0.5 rounded-full flex items-center space-x-1">
                            <div className="w-2 h-2 bg-green-600 rounded-full animate-pulse"></div>
                            <span>Generating</span>
                          </span>
                        )}
                      </h4>
                      
                      <div className="space-y-3">
                        {currentProject.insights.map((insight) => (
                          <div
                            key={insight.id}
                            className="border border-green-200 bg-green-50 rounded-lg p-3 transition-all duration-200"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center space-x-2 flex-1 min-w-0">
                                <h5 className="font-medium text-gray-900 text-sm">{insight.title}</h5>
                                <span className="text-xs bg-green-100 px-2 py-0.5 rounded-full text-green-600">
                                  {insight.category}
                                </span>
                              </div>
                              <div className="flex items-center space-x-2">
                                <span className="text-xs text-gray-500">
                                  Confidence: 
                                  <span className={`ml-1 font-medium ${
                                    insight.confidence > 0.8 ? 'text-green-600' :
                                    insight.confidence > 0.6 ? 'text-yellow-600' :
                                    'text-red-600'
                                  }`}>
                                    {Math.round(insight.confidence * 100)}%
                                  </span>
                                </span>
                                <button
                                  onClick={() => toggleInsightExpansion(insight.id)}
                                  className="p-1 rounded hover:bg-green-100"
                                >
                                  {expandedInsights.has(insight.id) ? 
                                    <ChevronUp size={14} className="text-green-600" /> : 
                                    <ChevronDown size={14} className="text-gray-400" />
                                  }
                                </button>
                              </div>
                            </div>
                            
                            {expandedInsights.has(insight.id) && (
                              <div className="mt-2 p-3 bg-white border border-gray-200 rounded-lg text-xs text-gray-700">
                                <div className="whitespace-pre-wrap">{insight.description}</div>
                                <div className="mt-2 pt-2 border-t border-gray-200 flex items-center justify-between">
                                  <span className="text-xs text-gray-500">Generated by: {insight.model}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Visualizations Section */}
                  {currentProject.visualizations.length > 0 && (
                    <div>
                      <h4 className="text-lg font-medium text-gray-900 mb-3 flex items-center space-x-2">
                        <BarChart3 size={18} className="text-green-600" />
                        <span>Data Visualizations</span>
                        {isGenerating && currentProject.status === 'visualizing' && (
                          <span className="text-sm text-green-600 bg-green-100 px-2 py-0.5 rounded-full flex items-center space-x-1">
                            <div className="w-2 h-2 bg-green-600 rounded-full animate-pulse"></div>
                            <span>Generating</span>
                          </span>
                        )}
                      </h4>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {currentProject.visualizations.map((viz) => (
                          <div
                            key={viz.id}
                            className="border border-gray-200 bg-white rounded-lg p-3 transition-all duration-200 hover:shadow-md"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center space-x-2">
                                {getVisualizationIcon(viz.type)}
                                <h5 className="font-medium text-gray-900 text-sm">{viz.title}</h5>
                              </div>
                            </div>
                            
                            {viz.imageUrl && (
                              <div className="mb-2 bg-gray-100 rounded-lg overflow-hidden">
                                <img 
                                  src={viz.imageUrl} 
                                  alt={viz.title} 
                                  className="w-full h-auto object-cover"
                                />
                              </div>
                            )}
                            
                            <p className="text-xs text-gray-600">{viz.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {isGenerating && (
                    <div className="text-center py-6">
                      <div className="w-8 h-8 border-4 border-green-200 border-t-green-600 rounded-full animate-spin mx-auto mb-4"></div>
                      <p className="text-gray-600">
                        {currentProject.status === 'planning' ? 'Planning analysis approach...' :
                         currentProject.status === 'cleaning' ? 'Cleaning and preparing data...' :
                         currentProject.status === 'analyzing' ? 'Generating insights...' :
                         currentProject.status === 'visualizing' ? 'Creating visualizations...' :
                         'Processing data...'}
                      </p>
                    </div>
                  )}
                </div>
                <div ref={messagesEndRef} />
              </div>
            </div>
          )}

          {step === 'completed' && currentProject && (
            <div className="p-6 h-full overflow-y-auto">
              <div className="max-w-4xl mx-auto">
                <div className="text-center mb-8">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle size={32} className="text-green-600" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">Analysis Complete!</h3>
                  <p className="text-gray-600 mb-6">
                    Your analysis of "{currentProject.description}" has been completed with {currentProject.insights.length} insights and {currentProject.visualizations.length} visualizations.
                  </p>
                </div>

                {/* Analysis Summary */}
                <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                    <BookOpen size={18} className="text-green-600" />
                    <span>Analysis Summary</span>
                  </h4>
                  
                  <div className="prose prose-sm max-w-none">
                    <div className="whitespace-pre-wrap">{currentProject.summary}</div>
                  </div>
                </div>

                {/* Visualizations Gallery */}
                {currentProject.visualizations.length > 0 && (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-6">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4">Visualization Gallery</h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {currentProject.visualizations.map((viz) => (
                        <div
                          key={viz.id}
                          className="border border-gray-200 bg-white rounded-lg p-3 transition-all duration-200 hover:shadow-md"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center space-x-2">
                              {getVisualizationIcon(viz.type)}
                              <h5 className="font-medium text-gray-900 text-sm">{viz.title}</h5>
                            </div>
                          </div>
                          
                          {viz.imageUrl && (
                            <div className="mb-2 bg-gray-100 rounded-lg overflow-hidden">
                              <img 
                                src={viz.imageUrl} 
                                alt={viz.title} 
                                className="w-full h-auto object-cover"
                              />
                            </div>
                          )}
                          
                          <p className="text-xs text-gray-600">{viz.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Export Options */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-6">
                  <h4 className="font-semibold text-gray-900 mb-4">Export Options</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {[
                      { format: 'pdf', label: 'PDF Report', icon: FileText, description: 'Complete analysis report with visualizations' },
                      { format: 'docx', label: 'Word Document', icon: FileCheck, description: 'Editable report in Microsoft Word format' },
                      { format: 'txt', label: 'Text Summary', icon: FileText, description: 'Plain text summary of key findings' }
                    ].map(({ format, label, icon: Icon, description }) => (
                      <button
                        key={format}
                        onClick={() => handleExport(format as any)}
                        className="flex flex-col items-center space-y-2 p-4 border border-gray-200 rounded-lg hover:bg-white hover:shadow-md transition-all duration-200 hover:scale-105"
                      >
                        <Icon size={24} className="text-green-600" />
                        <span className="text-sm font-medium">{label}</span>
                        <span className="text-xs text-gray-500 text-center">{description}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                    <div className="flex items-center space-x-2 text-red-700">
                      <AlertCircle size={16} />
                      <span className="text-sm">{error}</span>
                    </div>
                  </div>
                )}

                <div className="flex justify-center space-x-3">
                  <button
                    onClick={() => {
                      setStep('setup');
                      setCurrentProject(null);
                      setDataDescription('');
                      setAnalysisGoal('');
                      setExpandedInsights(new Set());
                    }}
                    className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    New Analysis
                  </button>
                  <button
                    onClick={onClose}
                    className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};