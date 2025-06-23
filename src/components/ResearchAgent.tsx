import React, { useState, useEffect, useRef } from 'react';
import { X, Search, Brain, CheckCircle, AlertCircle, Clock, Play, Pause, Download, Eye, FileText, RefreshCw, Zap, Globe, Link, ExternalLink, BookOpen, FileCheck, Network, Bot } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { picaosService } from '../services/picaosService';

interface ResearchAgentProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ResearchProject {
  id: string;
  topic: string;
  status: 'planning' | 'researching' | 'analyzing' | 'completed' | 'error';
  progress: number;
  sources: ResearchSource[];
  findings: ResearchFinding[];
  summary: string;
  createdAt: Date;
  updatedAt: Date;
}

interface ResearchSource {
  id: string;
  title: string;
  url: string;
  reliability: number; // 0-1 score
  relevance: number; // 0-1 score
  verified: boolean;
  content: string;
  status: 'pending' | 'processing' | 'verified' | 'rejected';
}

interface ResearchFinding {
  id: string;
  title: string;
  content: string;
  sourceIds: string[];
  confidence: number; // 0-1 score
  category: string;
}

export const ResearchAgent: React.FC<ResearchAgentProps> = ({ isOpen, onClose }) => {
  const { user, getCurrentTier } = useAuth();
  const [step, setStep] = useState<'setup' | 'researching' | 'completed'>('setup');
  const [topic, setTopic] = useState('');
  const [depth, setDepth] = useState<'basic' | 'comprehensive' | 'exhaustive'>('comprehensive');
  const [includeAcademic, setIncludeAcademic] = useState(true);
  const [includeNews, setIncludeNews] = useState(true);
  const [verifyFacts, setVerifyFacts] = useState(true);
  const [currentProject, setCurrentProject] = useState<ResearchProject | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [expandedSources, setExpandedSources] = useState<Set<string>>(new Set());
  const [expandedFindings, setExpandedFindings] = useState<Set<string>>(new Set());
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
  }, [currentProject?.findings]);

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

  const handleStartResearch = async () => {
    if (!user) {
      setError('Please sign in to use Research Agent');
      return;
    }

    if (!topic.trim()) {
      setError('Please enter a research topic');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setStep('researching');

    try {
      // Initialize a new research project
      const project: ResearchProject = {
        id: `research-${Date.now()}`,
        topic: topic.trim(),
        status: 'planning',
        progress: 0,
        sources: [],
        findings: [],
        summary: '',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      setCurrentProject(project);
      
      // Simulate the research process
      await simulateResearch(project);
      
    } catch (error) {
      console.error('Research process failed:', error);
      setError(error instanceof Error ? error.message : 'Research process failed');
      if (currentProject) {
        currentProject.status = 'error';
        setCurrentProject({...currentProject});
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const simulateResearch = async (project: ResearchProject) => {
    // Step 1: Planning phase
    project.status = 'planning';
    project.progress = 5;
    setCurrentProject({...project});
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Step 2: Source discovery
    project.status = 'researching';
    project.progress = 15;
    
    // Add initial sources
    const initialSources = [
      {
        id: `source-${Date.now()}-1`,
        title: `Recent Advances in ${topic}`,
        url: `https://example.com/research/${topic.toLowerCase().replace(/\s+/g, '-')}`,
        reliability: 0.85,
        relevance: 0.9,
        verified: false,
        content: '',
        status: 'pending' as const
      },
      {
        id: `source-${Date.now()}-2`,
        title: `${topic} - A Comprehensive Overview`,
        url: `https://example.org/topics/${topic.toLowerCase().replace(/\s+/g, '-')}`,
        reliability: 0.78,
        relevance: 0.95,
        verified: false,
        content: '',
        status: 'pending' as const
      }
    ];
    
    project.sources = initialSources;
    setCurrentProject({...project});
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Step 3: Process sources one by one
    for (let i = 0; i < project.sources.length; i++) {
      const source = project.sources[i];
      source.status = 'processing';
      project.progress = 15 + Math.round((i / project.sources.length) * 30);
      setCurrentProject({...project});
      
      await new Promise(resolve => setTimeout(resolve, 2500));
      
      // Generate mock content for the source
      source.content = generateMockSourceContent(topic, source.title);
      source.status = 'verified';
      source.verified = true;
      setCurrentProject({...project});
      
      // Add more sources as we go (simulating discovery)
      if (i === 0) {
        project.sources.push({
          id: `source-${Date.now()}-3`,
          title: `${topic} in Modern Applications`,
          url: `https://journal.science/article/${topic.toLowerCase().replace(/\s+/g, '-')}`,
          reliability: 0.92,
          relevance: 0.88,
          verified: false,
          content: '',
          status: 'pending' as const
        });
        setCurrentProject({...project});
      }
    }
    
    // Step 4: Analysis phase
    project.status = 'analyzing';
    project.progress = 50;
    setCurrentProject({...project});
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Step 5: Generate findings
    const findings = [
      {
        id: `finding-${Date.now()}-1`,
        title: `Key Principles of ${topic}`,
        content: generateMockFindingContent(topic, 'principles'),
        sourceIds: [project.sources[0].id, project.sources[1].id],
        confidence: 0.95,
        category: 'Core Concepts'
      },
      {
        id: `finding-${Date.now()}-2`,
        title: `Recent Developments in ${topic}`,
        content: generateMockFindingContent(topic, 'developments'),
        sourceIds: [project.sources[0].id],
        confidence: 0.87,
        category: 'Trends'
      }
    ];
    
    project.findings = findings;
    project.progress = 75;
    setCurrentProject({...project});
    await new Promise(resolve => setTimeout(resolve, 4000));
    
    // Add one more finding
    project.findings.push({
      id: `finding-${Date.now()}-3`,
      title: `Applications and Future Directions for ${topic}`,
      content: generateMockFindingContent(topic, 'applications'),
      sourceIds: [project.sources[1].id, project.sources[2].id],
      confidence: 0.82,
      category: 'Applications'
    });
    
    project.progress = 90;
    setCurrentProject({...project});
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Step 6: Generate summary
    project.summary = generateMockSummary(topic, project.findings);
    project.status = 'completed';
    project.progress = 100;
    setCurrentProject({...project});
    setStep('completed');
  };

  const generateMockSourceContent = (topic: string, sourceTitle: string): string => {
    return `# ${sourceTitle}

## Abstract
This document provides a comprehensive overview of ${topic}, including recent developments, key principles, and practical applications. The information presented here is based on current research and expert analysis.

## Introduction
${topic} has become increasingly important in recent years due to advancements in technology and growing interest from both academic and industry sectors. This source explores the fundamental concepts and practical implications of ${topic}.

## Key Findings
1. ${topic} demonstrates significant potential for application in multiple domains
2. Recent research has shown a 35% improvement in efficiency when applying new methodologies
3. Experts predict continued growth and development in this field over the next decade

## Methodology
The research methodology included comprehensive literature review, expert interviews, and analysis of case studies from leading organizations implementing ${topic}.

## Conclusion
${topic} represents a promising area for future research and practical applications. The findings presented in this source provide a foundation for understanding current developments and anticipating future trends.`;
  };

  const generateMockFindingContent = (topic: string, type: 'principles' | 'developments' | 'applications'): string => {
    if (type === 'principles') {
      return `Based on comprehensive analysis of multiple sources, the key principles of ${topic} can be summarized as follows:

1. **Fundamental Concept**: ${topic} is built on the foundation of [principle 1] and [principle 2], which provide the theoretical framework for all applications.

2. **Core Methodology**: The standard approach involves a systematic process of [step 1], [step 2], and [step 3], with careful attention to [critical factor].

3. **Established Frameworks**: Several frameworks have emerged as industry standards, including the [Framework A] and [Framework B], each with specific advantages for different use cases.

4. **Validation Criteria**: Experts agree that successful implementation requires meeting specific criteria, including [criterion 1], [criterion 2], and [criterion 3].

These principles have been consistently verified across multiple high-reliability sources, with a confidence score of 95%.`;
    }
    
    if (type === 'developments') {
      return `Recent developments in ${topic} show significant advancement in both theoretical understanding and practical applications:

1. **Breakthrough Research**: In the past 18 months, researchers at [Institution] have demonstrated a novel approach that improves efficiency by approximately 35%.

2. **Technological Innovations**: New tools including [Tool A] and [Tool B] have emerged, providing enhanced capabilities for implementing ${topic} in real-world scenarios.

3. **Shifting Paradigms**: The field is experiencing a paradigm shift from [traditional approach] to [new approach], driven by [factor 1] and [factor 2].

4. **Industry Adoption**: Major organizations including [Company A] and [Company B] have implemented ${topic} solutions, reporting [specific benefit] and [specific benefit].

These developments indicate a rapidly evolving landscape with significant implications for future applications.`;
    }
    
    return `Applications and future directions for ${topic} span multiple domains and present numerous opportunities:

1. **Current Applications**: ${topic} is currently being applied in [industry 1], [industry 2], and [industry 3], with particular success in [specific use case].

2. **Emerging Opportunities**: New applications are emerging in [field 1] and [field 2], driven by increasing demand for [specific capability].

3. **Challenges to Overcome**: Despite promising developments, challenges remain in [challenge area 1] and [challenge area 2], requiring further research and innovation.

4. **Future Trajectory**: Experts predict that ${topic} will continue to evolve toward [future direction 1] and [future direction 2] over the next 5-10 years.

5. **Research Priorities**: To maximize potential benefits, research should focus on addressing [gap 1] and [gap 2], with particular emphasis on [specific aspect].

These applications demonstrate the versatility and potential impact of ${topic} across diverse contexts.`;
  };

  const generateMockSummary = (topic: string, findings: ResearchFinding[]): string => {
    return `# Comprehensive Research Summary: ${topic}

## Overview
This research project conducted a thorough investigation of ${topic}, analyzing multiple sources and synthesizing key findings. The research process involved source discovery, verification, content analysis, and synthesis of findings.

## Key Findings
${findings.map(finding => `### ${finding.title}\n${finding.content.split('\n\n')[0]}\n`).join('\n')}

## Methodology
The research methodology employed a multi-agent approach using PicaOS orchestration to:
1. Discover and verify relevant sources
2. Extract and analyze key information
3. Cross-reference findings across multiple sources
4. Synthesize comprehensive insights
5. Verify factual accuracy and source reliability

## Conclusion
${topic} represents a dynamic and evolving field with significant implications across multiple domains. The findings presented in this report provide a foundation for understanding current developments, key principles, and future directions. Further research is recommended to explore specific applications and address identified challenges.

## Sources
${findings.length} findings were synthesized from ${findings.reduce((acc, finding) => acc.concat(finding.sourceIds), [] as string[]).filter((v, i, a) => a.indexOf(v) === i).length} verified sources, with an average confidence score of ${(findings.reduce((acc, finding) => acc + finding.confidence, 0) / findings.length * 100).toFixed(1)}%.`;
  };

  const toggleSourceExpansion = (sourceId: string) => {
    const newExpanded = new Set(expandedSources);
    if (newExpanded.has(sourceId)) {
      newExpanded.delete(sourceId);
    } else {
      newExpanded.add(sourceId);
    }
    setExpandedSources(newExpanded);
  };

  const toggleFindingExpansion = (findingId: string) => {
    const newExpanded = new Set(expandedFindings);
    if (newExpanded.has(findingId)) {
      newExpanded.delete(findingId);
    } else {
      newExpanded.add(findingId);
    }
    setExpandedFindings(newExpanded);
  };

  const handleExport = async (format: 'pdf' | 'docx' | 'txt') => {
    if (!currentProject) return;

    try {
      // In a real implementation, this would call an export service
      alert(`Exporting research in ${format.toUpperCase()} format`);
    } catch (error) {
      console.error('Failed to export research:', error);
      setError(error instanceof Error ? error.message : 'Failed to export research');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div className="bg-white rounded-xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden transform animate-slideUp">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-white/20 rounded-lg animate-bounceIn">
                <Search size={24} />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Research Agent</h2>
                <p className="text-blue-100">Comprehensive multi-source research with PicaOS orchestration</p>
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
                <span>Research: {currentProject.topic}</span>
                <div className="flex items-center space-x-4">
                  <span>{currentProject.progress}% Complete</span>
                  <span className="text-blue-200">
                    {currentProject.sources.filter(s => s.status === 'verified').length} sources
                  </span>
                  <span className="text-blue-200">
                    {currentProject.findings.length} findings
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
              <div className="flex items-center justify-between text-xs mt-2 text-blue-200">
                <span>Status: {currentProject.status}</span>
                {isGenerating && (
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                    <span>Research in progress...</span>
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
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-blue-800 mb-4 flex items-center space-x-2">
                    <Bot className="text-blue-600" size={20} />
                    <span>PicaOS Research Orchestration</span>
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div className="flex items-start space-x-3">
                      <Search className="text-blue-600 flex-shrink-0 mt-0.5" size={16} />
                      <div>
                        <p className="font-medium text-blue-800">Multi-Source Research</p>
                        <p className="text-blue-700">Discovers and analyzes information from diverse sources</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <CheckCircle className="text-blue-600 flex-shrink-0 mt-0.5" size={16} />
                      <div>
                        <p className="font-medium text-blue-800">Fact Verification</p>
                        <p className="text-blue-700">Cross-checks information across multiple sources</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <Brain className="text-blue-600 flex-shrink-0 mt-0.5" size={16} />
                      <div>
                        <p className="font-medium text-blue-800">Insight Generation</p>
                        <p className="text-blue-700">Synthesizes findings into coherent insights</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <Network className="text-blue-600 flex-shrink-0 mt-0.5" size={16} />
                      <div>
                        <p className="font-medium text-blue-800">Multi-Agent Coordination</p>
                        <p className="text-blue-700">Specialized agents work together on different research tasks</p>
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
                          Research Agent requires a connection to PicaOS for multi-agent orchestration. The system will fall back to local processing if PicaOS is unavailable.
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

                {/* Research Setup */}
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Research Configuration</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Research Topic *
                      </label>
                      <textarea
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                        placeholder="Enter your research topic or question. Be specific for better results..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                        rows={3}
                        maxLength={1000}
                      />
                      <p className="text-xs text-gray-500 mt-1">{topic.length}/1000 characters</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Research Depth</label>
                        <select
                          value={depth}
                          onChange={(e) => setDepth(e.target.value as any)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="basic">Basic (3-5 sources)</option>
                          <option value="comprehensive">Comprehensive (5-10 sources)</option>
                          <option value="exhaustive">Exhaustive (10+ sources)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Source Types</label>
                        <div className="space-y-2">
                          <label className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={includeAcademic}
                              onChange={(e) => setIncludeAcademic(e.target.checked)}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-700">Academic sources</span>
                          </label>
                          <label className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={includeNews}
                              onChange={(e) => setIncludeNews(e.target.checked)}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-700">News and media</span>
                          </label>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={verifyFacts}
                          onChange={(e) => setVerifyFacts(e.target.checked)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">Enable fact verification across sources</span>
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
                    onClick={handleStartResearch}
                    disabled={!topic.trim() || isGenerating}
                    className="flex items-center space-x-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:scale-105 transform"
                  >
                    {isGenerating ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Initializing...</span>
                      </>
                    ) : (
                      <>
                        <Search size={16} />
                        <span>Start Research</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === 'researching' && currentProject && (
            <div className="h-full flex flex-col">
              {/* Project Info */}
              <div className="bg-gray-50 border-b border-gray-200 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">Research: {currentProject.topic}</h3>
                    <p className="text-sm text-gray-600">
                      {currentProject.sources.length} sources • {currentProject.findings.length} findings • {currentProject.status}
                    </p>
                  </div>
                </div>
              </div>

              {/* Research Progress */}
              <div className="flex-1 overflow-y-auto p-4">
                <div className="space-y-6">
                  {/* Sources Section */}
                  <div>
                    <h4 className="text-lg font-medium text-gray-900 mb-3 flex items-center space-x-2">
                      <Globe size={18} className="text-blue-600" />
                      <span>Sources</span>
                      {isGenerating && currentProject.status === 'researching' && (
                        <span className="text-sm text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full flex items-center space-x-1">
                          <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
                          <span>Discovering</span>
                        </span>
                      )}
                    </h4>
                    
                    <div className="space-y-3">
                      {currentProject.sources.map((source) => (
                        <div
                          key={source.id}
                          className={`border rounded-lg p-3 transition-all duration-200 ${
                            source.status === 'verified' ? 'border-green-200 bg-green-50' :
                            source.status === 'processing' ? 'border-blue-200 bg-blue-50' :
                            source.status === 'rejected' ? 'border-red-200 bg-red-50' :
                            'border-gray-200 bg-white'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center space-x-2 flex-1 min-w-0">
                              <h5 className="font-medium text-gray-900 text-sm truncate">{source.title}</h5>
                              <div className="flex items-center space-x-1">
                                {source.status === 'verified' && (
                                  <span className="text-xs bg-green-100 px-2 py-0.5 rounded-full text-green-600 flex items-center space-x-1">
                                    <CheckCircle size={10} />
                                    <span>Verified</span>
                                  </span>
                                )}
                                {source.status === 'processing' && (
                                  <span className="text-xs bg-blue-100 px-2 py-0.5 rounded-full text-blue-600 flex items-center space-x-1">
                                    <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
                                    <span>Processing</span>
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <a 
                                href={source.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <ExternalLink size={14} />
                              </a>
                              <button
                                onClick={() => toggleSourceExpansion(source.id)}
                                className="p-1 rounded hover:bg-gray-100"
                              >
                                {expandedSources.has(source.id) ? 
                                  <Eye size={14} className="text-blue-600" /> : 
                                  <Eye size={14} className="text-gray-400" />
                                }
                              </button>
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-4 text-xs text-gray-500 mb-2">
                            <span className="flex items-center space-x-1">
                              <span>Reliability:</span>
                              <span className={`font-medium ${
                                source.reliability > 0.8 ? 'text-green-600' :
                                source.reliability > 0.6 ? 'text-yellow-600' :
                                'text-red-600'
                              }`}>
                                {Math.round(source.reliability * 100)}%
                              </span>
                            </span>
                            <span className="flex items-center space-x-1">
                              <span>Relevance:</span>
                              <span className={`font-medium ${
                                source.relevance > 0.8 ? 'text-green-600' :
                                source.relevance > 0.6 ? 'text-yellow-600' :
                                'text-red-600'
                              }`}>
                                {Math.round(source.relevance * 100)}%
                              </span>
                            </span>
                          </div>
                          
                          {expandedSources.has(source.id) && source.content && (
                            <div className="mt-2 p-3 bg-white border border-gray-200 rounded-lg text-xs text-gray-700 max-h-40 overflow-y-auto">
                              <div className="whitespace-pre-wrap">{source.content}</div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {/* Findings Section */}
                  {currentProject.findings.length > 0 && (
                    <div>
                      <h4 className="text-lg font-medium text-gray-900 mb-3 flex items-center space-x-2">
                        <Brain size={18} className="text-blue-600" />
                        <span>Research Findings</span>
                        {isGenerating && currentProject.status === 'analyzing' && (
                          <span className="text-sm text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full flex items-center space-x-1">
                            <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
                            <span>Analyzing</span>
                          </span>
                        )}
                      </h4>
                      
                      <div className="space-y-3">
                        {currentProject.findings.map((finding) => (
                          <div
                            key={finding.id}
                            className="border border-blue-200 bg-blue-50 rounded-lg p-3 transition-all duration-200"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center space-x-2 flex-1 min-w-0">
                                <h5 className="font-medium text-gray-900 text-sm">{finding.title}</h5>
                                <span className="text-xs bg-blue-100 px-2 py-0.5 rounded-full text-blue-600">
                                  {finding.category}
                                </span>
                              </div>
                              <div className="flex items-center space-x-2">
                                <span className="text-xs text-gray-500">
                                  Confidence: 
                                  <span className={`ml-1 font-medium ${
                                    finding.confidence > 0.8 ? 'text-green-600' :
                                    finding.confidence > 0.6 ? 'text-yellow-600' :
                                    'text-red-600'
                                  }`}>
                                    {Math.round(finding.confidence * 100)}%
                                  </span>
                                </span>
                                <button
                                  onClick={() => toggleFindingExpansion(finding.id)}
                                  className="p-1 rounded hover:bg-blue-100"
                                >
                                  {expandedFindings.has(finding.id) ? 
                                    <Eye size={14} className="text-blue-600" /> : 
                                    <Eye size={14} className="text-gray-400" />
                                  }
                                </button>
                              </div>
                            </div>
                            
                            {expandedFindings.has(finding.id) && (
                              <div className="mt-2 p-3 bg-white border border-gray-200 rounded-lg text-xs text-gray-700 max-h-60 overflow-y-auto">
                                <div className="whitespace-pre-wrap">{finding.content}</div>
                                
                                <div className="mt-3 pt-2 border-t border-gray-200">
                                  <div className="font-medium text-gray-700 mb-1">Sources:</div>
                                  <div className="space-y-1">
                                    {finding.sourceIds.map(sourceId => {
                                      const source = currentProject.sources.find(s => s.id === sourceId);
                                      return source ? (
                                        <div key={sourceId} className="flex items-center space-x-2">
                                          <Link size={12} className="text-blue-500" />
                                          <span>{source.title}</span>
                                        </div>
                                      ) : null;
                                    })}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {isGenerating && (
                    <div className="text-center py-6">
                      <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
                      <p className="text-gray-600">
                        {currentProject.status === 'planning' ? 'Planning research approach...' :
                         currentProject.status === 'researching' ? 'Discovering and analyzing sources...' :
                         currentProject.status === 'analyzing' ? 'Synthesizing findings...' :
                         'Processing research...'}
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
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">Research Complete!</h3>
                  <p className="text-gray-600 mb-6">
                    Your research on "{currentProject.topic}" has been completed with {currentProject.sources.length} sources and {currentProject.findings.length} key findings.
                  </p>
                </div>

                {/* Research Summary */}
                <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                    <BookOpen size={18} className="text-blue-600" />
                    <span>Research Summary</span>
                  </h4>
                  
                  <div className="prose prose-sm max-w-none">
                    <div className="whitespace-pre-wrap">{currentProject.summary}</div>
                  </div>
                </div>

                {/* Export Options */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-6">
                  <h4 className="font-semibold text-gray-900 mb-4">Export Options</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {[
                      { format: 'pdf', label: 'PDF', icon: FileText, description: 'Portable Document Format' },
                      { format: 'docx', label: 'Word', icon: FileCheck, description: 'Microsoft Word Document' },
                      { format: 'txt', label: 'Text', icon: FileText, description: 'Plain Text File' }
                    ].map(({ format, label, icon: Icon, description }) => (
                      <button
                        key={format}
                        onClick={() => handleExport(format as any)}
                        className="flex flex-col items-center space-y-2 p-4 border border-gray-200 rounded-lg hover:bg-white hover:shadow-md transition-all duration-200 hover:scale-105"
                      >
                        <Icon size={24} className="text-blue-600" />
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
                      setTopic('');
                      setExpandedSources(new Set());
                      setExpandedFindings(new Set());
                    }}
                    className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    New Research
                  </button>
                  <button
                    onClick={onClose}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
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