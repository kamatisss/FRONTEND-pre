import { isIos, promptInstall } from './pwa';
import { usePwa } from './usePwa';

/*
 * One "Install app" behaviour for every entry point (account menu, phone menus, footer, install card):
 *   available   this device can install it and it isn't installed (or open as the app) already
 *   ios         iPhone/iPad: no install button exists, show the Share → Add to Home Screen steps instead
 *   install()   Android / desktop Chrome & Edge: the browser's own prompt → 'accepted' | 'dismissed' | 'steps'
 */
export function useInstall() {
  const { installEvent, installed } = usePwa();
  const ios = isIos();
  const available = !installed && (!!installEvent || ios);
  const install = async () => (installEvent ? promptInstall() : 'steps');
  return { available, ios, install };
}
