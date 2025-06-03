declare module 'ketcher-standalone' {
  import { StructServiceProvider, StructService, StructServiceOptions } from 'ketcher-core';
  
  export class StandaloneStructServiceProvider implements StructServiceProvider {
    mode: 'standalone';
    createStructService(options?: StructServiceOptions): StructService;
  }
}