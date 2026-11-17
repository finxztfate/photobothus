import { getLayoutPhotoCount, getLayoutPhotoSlotAspect } from './stripLayouts';

export const cameraSettings = {
  layout: [
    { id: 1, name: 'Classic Strip' },
    { id: 2, name: '4x4 Frame' },
    { id: 3, name: 'Polaroid' },
    { id: 4, name: 'Wide Strip' },
    { id: 5, name: 'Wide Landscape' },
    { id: 6, name: 'Size 4x6 3 Poses' },
    { id: 7, name: 'Size 4x6 4 Poses' },
    { id: 8, name: 'Triple Strip' },
    { id: 9, name: '6-Photo Grid' },
    { id: 10, name: 'Film Strip' },
    { id: 11, name: 'Feature Frame' },
  ],
  flash: [
    { id: 'auto', name: 'Auto' },
    { id: 'on', name: 'On' },
    { id: 'off', name: 'Off' },
  ],
  timer: [
    { id: '3', name: '3s' },
    { id: '5', name: '5s' },
    { id: '10', name: '10s' },
  ],
  guide: [
    { id: 'on', name: 'On' },
    { id: 'off', name: 'Off' },
  ],
};

export async function getAvailableCameras() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(device => device.kind === 'videoinput');
    return videoDevices.map((device, index) => ({
      id: device.deviceId,
      name: device.label || `Camera ${index + 1}`,
    }));
  } catch (error) {
    console.error('Error enumerating cameras:', error);
    return [];
  }
}

export const filterPresets = [
  { id: 'normal', name: 'Original', css: 'none' },
  { id: 'sepia', name: 'Sepia', css: 'sepia(80%) contrast(105%)' },
  { id: 'vintage', name: 'Vintage', css: 'sepia(45%) contrast(115%) brightness(95%) saturate(85%)' },
  { id: 'polaroid', name: 'Polaroid', css: 'sepia(20%) contrast(90%) brightness(118%) saturate(80%)' },
  { id: 'film', name: 'Film', css: 'sepia(18%) contrast(125%) saturate(75%) brightness(96%)' },
  { id: 'faded', name: 'Faded', css: 'sepia(25%) contrast(85%) brightness(112%) saturate(70%)' },
  { id: 'super8', name: 'Super 8', css: 'sepia(35%) contrast(130%) saturate(90%) brightness(92%)' },
  { id: 'bwfilm', name: 'B&W Film', css: 'grayscale(100%) contrast(120%) brightness(95%)' },
  { id: 'noir', name: 'Noir', css: 'grayscale(100%) contrast(145%) brightness(88%)' },
  { id: 'nostalgia', name: 'Nostalgia', css: 'sepia(60%) hue-rotate(-12deg) contrast(108%) saturate(70%)' },
  { id: 'dusty', name: 'Dusty', css: 'sepia(30%) contrast(95%) brightness(105%) saturate(65%)' },
  { id: 'retro', name: 'Retro', css: 'sepia(22%) hue-rotate(-18deg) saturate(125%) contrast(112%)' },
  { id: 'seventies', name: '1977', css: 'sepia(40%) hue-rotate(-22deg) saturate(135%) contrast(110%) brightness(108%)' },
  // slotAspect: [min, max] width/height every photo slot in a layout must fit for the frame to look right.
  { id: 'instant', name: 'Instant', css: 'sepia(18%) contrast(92%) brightness(112%) saturate(85%)', frame: 'instant', slotAspect: [0.7, 1.02] },
  { id: 'film35', name: '35mm', css: 'sepia(15%) contrast(120%) saturate(80%) brightness(98%)', frame: 'film35', slotAspect: [1.05, 1.8] },
  { id: 'antique', name: 'Antique', css: 'sepia(90%) contrast(110%) brightness(92%) saturate(80%)', frame: 'antique' },
  { id: 'disposable', name: 'Disposable', css: 'sepia(20%) hue-rotate(-10deg) saturate(130%) contrast(115%) brightness(106%)', frame: 'disposable' },
  { id: 'vhs', name: 'VHS', css: 'saturate(140%) contrast(118%) brightness(104%) hue-rotate(-6deg)', frame: 'vhs', slotAspect: [1.25, 2] },
  { id: 'silent', name: 'Silent Film', css: 'grayscale(100%) contrast(135%) brightness(92%)', frame: 'silent', slotAspect: [0.9, 2.4] },
];

export function getFilterFrame(filterId) {
  return filterPresets.find((preset) => preset.id === filterId)?.frame || null;
}

export function getFiltersForLayout(layoutId) {
  const aspects = Array.from(
    { length: getLayoutPhotoCount(layoutId) },
    (_, index) => getLayoutPhotoSlotAspect(layoutId, index)
  );
  return filterPresets.filter(({ slotAspect }) => (
    !slotAspect || aspects.every((aspect) => aspect >= slotAspect[0] && aspect <= slotAspect[1])
  ));
}
