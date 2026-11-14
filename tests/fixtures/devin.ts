export interface DevinFixtureStep {
  stepId: number;
  source: 'agent' | 'user' | 'system';
  timestamp: string;
  modelName?: string;
  generationModel?: string;
  metrics?: {
    promptTokens: number;
    completionTokens: number;
    cachedTokens?: number;
  };
}

export interface DevinFixtureSession {
  sessionId: string;
  agentModel?: string;
  steps: DevinFixtureStep[];
}

export function makeDevinTranscript(session: DevinFixtureSession): string {
  const steps = session.steps.map((step) => {
    const rawStep: Record<string, unknown> = {
      step_id: step.stepId,
      timestamp: step.timestamp,
      source: step.source,
      message: 'test message',
    };

    if (step.modelName) rawStep.model_name = step.modelName;

    if (step.generationModel) {
      rawStep.extra = {
        generation_model: step.generationModel,
      };
    }

    if (step.metrics) {
      rawStep.metrics = {
        prompt_tokens: step.metrics.promptTokens,
        completion_tokens: step.metrics.completionTokens,
        cached_tokens: step.metrics.cachedTokens ?? 0,
      };
    }

    return rawStep;
  });

  return JSON.stringify({
    schema_version: 'ATIF-v1.7',
    session_id: session.sessionId,
    agent: {
      name: 'devin',
      version: '3000.12.32',
      model_name: session.agentModel ?? 'swe-2-flash-medium',
    },
    steps,
  });
}
