import { create } from 'zustand';
import { LiveRunState, MessageParticleItem } from '../types/domain';
import { NerveEvent } from '../types/events';
import { createInitialLiveRunState } from './initialState';
import { applyEvent } from './reducer';
import { Choreographer } from './choreographer';
import { MockEventStream } from '../mock/mockStream';
import { subscribeToAnalysisEvents, SSEConnection } from '../api/sse';

interface NerveStoreState extends LiveRunState {
  // Actions
  startMockRun: () => void;
  startLiveRun: (analysisId: string, filename?: string, sha256?: string) => void;
  stopRun: () => void;
  togglePause: () => void;
  setSpeed: (speed: number) => void;
  stepForward: () => void;
  reset: () => void;
  toggleDemoMode: () => void;
  selectItem: (item: { type: 'agent' | 'edge' | 'artifact' | 'finding'; id: string } | null) => void;
  addParticle: (particle: MessageParticleItem) => void;
  removeParticle: (particleId: string) => void;
  dismissToast: (id: string) => void;
}

let activeChoreographer: Choreographer | null = null;
let activeMockStream: MockEventStream | null = null;
let activeSSE: SSEConnection | null = null;

export const useNerveStore = create<NerveStoreState>((set, get) => {
  const initChoreographer = () => {
    if (activeChoreographer) {
      activeChoreographer.clear();
    }

    activeChoreographer = new Choreographer({
      onEventDispatched: (event: NerveEvent) => {
        set((state) => applyEvent(state, event));
      },
      onParticleAdded: (particle: MessageParticleItem) => {
        get().addParticle(particle);
      },
      onParticleRemoved: (particleId: string) => {
        get().removeParticle(particleId);
      },
    });
    activeChoreographer.setSpeed(get().speed);
  };

  return {
    ...createInitialLiveRunState(),

    startMockRun: async () => {
      get().reset();
      initChoreographer();

      if (activeSSE) {
        activeSSE.close();
        activeSSE = null;
      }

      const defaultFilename = 'AndroGoat.apk';
      const defaultSha256 = '3e6f6b538b82874dd94c0d8cdadd69ba54d49b59d2c7eb055073892e8a4fc0e0';

      set({
        isMock: true,
        isLive: true,
        status: 'running',
        isPaused: false,
        filename: defaultFilename,
        sha256: defaultSha256,
      });

      // Connect that data to backend: create record in DB so logs and telemetry are captured
      let backendAnalysisId: string | null = null;
      try {
        const res = await fetch('/api/analyses/rerun', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: defaultFilename,
            sha256: defaultSha256,
            variant: 'v2_multi',
          }),
        });
        if (res.ok) {
          const data = await res.json();
          backendAnalysisId = data.analysis_id;
          if (backendAnalysisId) {
            set({ analysisId: backendAnalysisId });
          }
        }
      } catch (e) {
        console.warn('Backend rerun connection failed, streaming locally:', e);
      }

      activeMockStream = new MockEventStream(
        (event) => {
          activeChoreographer?.enqueue(event);

          // Stream event to backend so it's captured in terminal logs and Postgres DB
          const currentId = backendAnalysisId || get().analysisId;
          if (currentId) {
            fetch(`/api/analyses/${currentId}/events`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                type: event.type,
                payload: event.payload || {},
              }),
            }).catch(() => {});
          }
        },
        () => {
          // Completed
        }
      );
      activeMockStream.setSpeed(get().speed);
      activeMockStream.start();
    },

    startLiveRun: (analysisId: string, filename?: string, sha256?: string) => {
      get().reset();
      initChoreographer();

      if (activeMockStream) {
        activeMockStream.stop();
        activeMockStream = null;
      }

      set({
        analysisId,
        filename: filename || get().filename,
        sha256: sha256 || get().sha256,
        isMock: false,
        isLive: true,
        status: 'running',
        isPaused: false,
      });

      activeSSE = subscribeToAnalysisEvents(
        analysisId,
        (event) => {
          activeChoreographer?.enqueue(event);
        },
        (doneStatus) => {
          set((state) => ({
            status: doneStatus === 'failed' ? 'failed' : 'completed',
          }));
        },
        (_err) => {
          // Keep running or show fallback toast
        }
      );
    },

    stopRun: () => {
      activeMockStream?.stop();
      activeSSE?.close();
      activeChoreographer?.clear();
      set({ isLive: false, status: 'idle' });
    },

    togglePause: () => {
      const nextPaused = !get().isPaused;
      set({ isPaused: nextPaused });
      activeChoreographer?.setPaused(nextPaused);
      if (nextPaused) {
        activeMockStream?.pause();
      } else {
        activeMockStream?.resume();
      }
    },

    setSpeed: (speed: number) => {
      set({ speed });
      activeChoreographer?.setSpeed(speed);
      activeMockStream?.setSpeed(speed);
    },

    stepForward: () => {
      activeChoreographer?.stepForward();
      activeMockStream?.stepForward();
    },

    reset: () => {
      activeMockStream?.stop();
      activeSSE?.close();
      activeChoreographer?.clear();
      set({
        ...createInitialLiveRunState({
          speed: get().speed,
          demoMode: get().demoMode,
        }),
      });
    },

    toggleDemoMode: () => {
      set((state) => ({ demoMode: !state.demoMode }));
    },

    selectItem: (item) => {
      set({ selectedItem: item });
    },

    addParticle: (particle) => {
      set((state) => ({
        particles: [...state.particles.filter((p) => p.id !== particle.id), particle],
      }));
    },

    removeParticle: (particleId) => {
      set((state) => ({
        particles: state.particles.filter((p) => p.id !== particleId),
      }));
    },

    dismissToast: (id) => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }));
    },
  };
});
