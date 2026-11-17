export {
  STRIP_LAYOUTS,
  layouts,
  getLayoutById,
  resolveLayoutId,
  getLayoutPhotoCount,
  getLayoutCssClass,
  getPhotoPlacements,
  getDarkPlacements,
  computeStripDimensions,
  getLayoutCellRects,
  getLayoutPhotoSlotAspect,
  BOOTH_CAPTURE_ASPECT,
  getBoothCaptureAspect,
  fitAspectInBox,
  getLayoutThumbSize,
  getLayoutThumbWidth,
  computeSideThumbSize,
  computeRowThumbSize,
  computeSideThumbSlots,
  computeRowThumbSlots,
  computeAlignedSideThumbSlots,
  computeAlignedRowThumbSlots,
  getBoothThumbLayoutMode,
} from './stripLayouts';

export const overlayFilters = [
  {
    id: 1,
    name: 'Dog',
    image: '/filters/dog-filter.png',
  },
];
