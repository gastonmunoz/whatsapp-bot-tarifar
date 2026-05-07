import { Controller, Get, Inject } from '@nestjs/common';
import { StateService } from '../state/state.service';

const STARTED_AT = Date.now();
const DEPLOYED_AT = new Date().toISOString();

@Controller()
export class HealthController {
  constructor(private readonly state: StateService) {}

  @Get()
  root() {
    return {
      ok: true,
      bot: 'TarifAR',
      slug: 'tarifar',
      office: 'Decodificador de boletas de servicios publicos (luz, gas, agua)',
      version: '0.1.0',
      uptime_seconds: Math.floor((Date.now() - STARTED_AT) / 1000),
      active_phones_in_memory: this.state.activeCount(),
      deployed_at: DEPLOYED_AT,
    };
  }
}
