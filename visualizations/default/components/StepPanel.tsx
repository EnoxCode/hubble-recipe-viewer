import React from 'react';
import type { ProcessedGroup } from '../types';
import { Callout } from './Callout';

interface StepPanelProps {
  groups: ProcessedGroup[];
  currentGroupIndex: number;
  currentStepIndex: number;
  totalSteps: number;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds} sec`;
  const mins = Math.round(seconds / 60);
  return `${mins} min`;
}

function formatDurationRange(minSeconds: number, maxSeconds: number): string {
  const minVal = minSeconds < 60 ? minSeconds : Math.round(minSeconds / 60);
  const maxVal = maxSeconds < 60 ? maxSeconds : Math.round(maxSeconds / 60);
  const unit = maxSeconds < 60 ? 'sec' : 'min';
  return `${minVal}-${maxVal} ${unit}`;
}

export function StepPanel({
  groups,
  currentGroupIndex,
  currentStepIndex,
  totalSteps,
}: StepPanelProps) {
  const currentGroup = groups[currentGroupIndex];
  const currentStep = currentGroup?.steps[currentStepIndex];

  // Calculate global step index for progress
  let globalStepIndex = 0;
  for (let g = 0; g < currentGroupIndex; g++) {
    globalStepIndex += groups[g].steps.length;
  }
  globalStepIndex += currentStepIndex + 1;

  const progressPercent = totalSteps > 0 ? (globalStepIndex / totalSteps) * 100 : 0;

  // Determine previous step
  let prevStepText: string | null = null;
  if (currentStepIndex > 0) {
    prevStepText = currentGroup.steps[currentStepIndex - 1].text;
  } else if (currentGroupIndex > 0) {
    const prevGroup = groups[currentGroupIndex - 1];
    prevStepText = prevGroup.steps[prevGroup.steps.length - 1].text;
  }

  return (
    <>
      <div className="rcp-step-nav">
        <div className="rcp-step-nav-left">
          <span className="label-text">{currentGroup.name}</span>
          <span className="muted-text">
            {currentStepIndex + 1} of {currentGroup.steps.length}
          </span>
        </div>
        <div className="rcp-dots">
          {groups.map((group, i) => {
            const classes = [
              'rcp-dot',
              i === currentGroupIndex && 'rcp-dot--active',
              i < currentGroupIndex && 'rcp-dot--done',
            ]
              .filter(Boolean)
              .join(' ');
            return <div key={group.name} className={classes} />;
          })}
        </div>
      </div>

      <div className="rcp-progress">
        <div
          className="rcp-progress-fill"
          style={{ width: `${progressPercent.toFixed(2)}%` }}
        />
      </div>

      <div className="rcp-step-body">
        {prevStepText && (
          <div className="rcp-prev-step">{prevStepText}</div>
        )}

        {currentStep && (
          <>
            <div className="rcp-step-text">{currentStep.text}</div>

            {hasCallouts(currentStep) && (
              <div className="rcp-callouts">
                {currentStep.timers.map((timer, i) => {
                  const subtitle = timer.maxDurationSeconds
                    ? formatDurationRange(timer.durationSeconds, timer.maxDurationSeconds)
                    : formatDuration(timer.durationSeconds);
                  return (
                    <Callout
                      key={`timer-${i}`}
                      type="timer"
                      title={timer.label}
                      subtitle={subtitle}
                    />
                  );
                })}
                {currentStep.temperature && (
                  <Callout type="temp" title={currentStep.temperature} />
                )}
                {currentStep.technique && (
                  <Callout type="technique" title={currentStep.technique} />
                )}
                {currentStep.equipment.length > 0 && (
                  <Callout type="equip" title={currentStep.equipment.join(', ')} />
                )}
                {currentStep.goodToKnow && (
                  <Callout type="tip" title={currentStep.goodToKnow} />
                )}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

function hasCallouts(step: NonNullable<ReturnType<typeof Object.values<ProcessedGroup['steps']>>>[number]): boolean {
  return (
    step.timers.length > 0 ||
    step.temperature !== null ||
    step.technique !== null ||
    step.equipment.length > 0 ||
    step.goodToKnow !== null
  );
}
