/**
 * Shared test utilities for Angular test factories.
 */
import { OGridService } from '../services/ogrid.service';
import type { FixtureRow } from './fixtures';

export interface OGridInstance {
  props?: unknown;
  ogridService?: OGridService<FixtureRow>;
  service?: OGridService<FixtureRow>;
  _testService?: OGridService<FixtureRow>;
}

/**
 * Helper: get OGridService from component.
 * Supports both `ogridService` (Material/Radix) and `service` (PrimeNG via inject) property names.
 * If inject() returned undefined in mock env, creates and attaches the service.
 */
export function getService(instance: OGridInstance): OGridService<FixtureRow> {
  if (instance.ogridService instanceof OGridService) return instance.ogridService;
  if (instance.service instanceof OGridService) return instance.service;
  // If inject() returned undefined in mock env, create and attach the service
  const svc = new OGridService<FixtureRow>();
  if ('ogridService' in instance) instance.ogridService = svc;
  else if ('service' in instance) instance.service = svc;
  else instance.ogridService = svc;
  return svc;
}
