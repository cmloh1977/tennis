// Makes media/keepawake.mp4: a tiny, silent, black 2-second video.
// Playing it on a muted loop keeps the screen on in browsers that don't
// support the "wake lock" feature (a well-known backup trick).
//
// Usage: swift tools/make-keepawake-video.swift
import AVFoundation
import Foundation

let size = 16
let frames = 2           // one frame per second, 2 seconds
let url = URL(fileURLWithPath: "media/keepawake.mp4")
try? FileManager.default.createDirectory(atPath: "media", withIntermediateDirectories: true)
try? FileManager.default.removeItem(at: url)

let writer = try AVAssetWriter(outputURL: url, fileType: .mp4)
let input = AVAssetWriterInput(mediaType: .video, outputSettings: [
  AVVideoCodecKey: AVVideoCodecType.h264,
  AVVideoWidthKey: size,
  AVVideoHeightKey: size,
])
let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: input, sourcePixelBufferAttributes: [
  kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
  kCVPixelBufferWidthKey as String: size,
  kCVPixelBufferHeightKey as String: size,
])
writer.add(input)
writer.startWriting()
writer.startSession(atSourceTime: .zero)

for frame in 0..<frames {
  var buffer: CVPixelBuffer?
  CVPixelBufferCreate(nil, size, size, kCVPixelFormatType_32BGRA, nil, &buffer)
  CVPixelBufferLockBaseAddress(buffer!, [])
  memset(CVPixelBufferGetBaseAddress(buffer!), 0, CVPixelBufferGetDataSize(buffer!))   // black
  CVPixelBufferUnlockBaseAddress(buffer!, [])
  while !input.isReadyForMoreMediaData { usleep(1000) }
  adaptor.append(buffer!, withPresentationTime: CMTime(value: CMTimeValue(frame), timescale: 1))
}

input.markAsFinished()
writer.endSession(atSourceTime: CMTime(value: CMTimeValue(frames), timescale: 1))
let done = DispatchSemaphore(value: 0)
writer.finishWriting { done.signal() }
done.wait()
print(writer.status == .completed ? "media/keepawake.mp4" : "Failed: \(String(describing: writer.error))")
