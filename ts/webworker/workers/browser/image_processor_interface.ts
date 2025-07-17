import { join } from 'path';
import { getAppRootPath } from '../../../node/getRootPath';
import { WorkerInterface } from '../../worker_interface';
import type { ImageProcessorWorkerActions } from '../node/image_processor/image_processor';

let imageProcessorWorkerInterface: WorkerInterface | undefined;

type WorkerAllowedFunctionName = keyof ImageProcessorWorkerActions;

const internalCallImageProcessorWorker = async (
  fnName: WorkerAllowedFunctionName,
  ...args: any
): Promise<any> => {
  if (!imageProcessorWorkerInterface) {
    const imageProcessorWorkerPath = join(
      getAppRootPath(),
      'ts',
      'webworker',
      'workers',
      'node',
      'image_processor',
      'image_processor.worker.compiled.js'
    );
    // if we need more than 1minute to resize an image, we have a bigger issue...
    imageProcessorWorkerInterface = new WorkerInterface(imageProcessorWorkerPath, 1 * 60 * 1000);
  }
  return imageProcessorWorkerInterface?.callWorker(fnName, ...args);
};

export async function callImageProcessorWorker<T extends WorkerAllowedFunctionName>(
  fnName: T,
  ...args: Parameters<ImageProcessorWorkerActions[T]>
): Promise<Awaited<ReturnType<ImageProcessorWorkerActions[T]>>> {
  return internalCallImageProcessorWorker(fnName, ...args);
}
