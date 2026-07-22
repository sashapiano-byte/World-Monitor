/**
 * Adapter barrel — importing this module registers every layer adapter as a
 * side effect. Route handlers / ingestion import this once so the registry is
 * populated before any `adapter_key` is resolved.
 *
 * Adding a new source = add its adapter file + one import line here.
 */
import './adapters/isw_arcgis';
import './adapters/viina';
import './adapters/nasa_firms';
import './adapters/oryx';
import './adapters/acled';
import './adapters/ucdp_ged';
import './adapters/hdx';

export * from './registry';
export * from './types';
