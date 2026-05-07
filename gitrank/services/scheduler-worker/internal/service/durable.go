package service

import (
	"context"
	"time"
)

func (s *Service) withDurableMutation(ctx context.Context, now time.Time, fn func() error) error {
	if s == nil || s.stateStore == nil {
		return fn()
	}

	s.durableMu.Lock()
	defer s.durableMu.Unlock()

	loaded := durableSchedulerState{}
	err := s.stateStore.Mutate(ctx, now.UTC(), func(state durableSchedulerState) (durableSchedulerState, error) {
		loaded = state
		if err := s.restoreDurableState(state); err != nil {
			return durableSchedulerState{}, err
		}
		if err := fn(); err != nil {
			_ = s.restoreDurableState(state)
			return durableSchedulerState{}, err
		}
		return s.captureDurableState(), nil
	})
	if err != nil {
		_ = s.restoreDurableState(loaded)
	}
	return err
}

func (s *Service) refreshDurableState(ctx context.Context) error {
	if s == nil || s.stateStore == nil {
		return nil
	}

	s.durableMu.Lock()
	defer s.durableMu.Unlock()

	state, found, err := s.stateStore.Load(ctx)
	if err != nil {
		return err
	}
	if !found {
		return s.restoreDurableState(durableSchedulerState{})
	}
	return s.restoreDurableState(state)
}

func (s *Service) tryRefreshDurableState() {
	_ = s.refreshDurableState(context.Background())
}
