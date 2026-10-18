import Foundation
import AVFoundation
import AppKit
let input = CommandLine.arguments[1]
let output = CommandLine.arguments[2]
let asset = AVURLAsset(url: URL(fileURLWithPath: input))
let duration = CMTimeGetSeconds(asset.duration)
let tracks = asset.tracks(withMediaType: .video)
print("DURATION_SECONDS \(duration)")
if let track = tracks.first { print("NATURAL_SIZE \(track.naturalSize) TRANSFORM \(track.preferredTransform)") }
let gen = AVAssetImageGenerator(asset: asset)
gen.appliesPreferredTrackTransform = true
gen.maximumSize = CGSize(width: 1600, height: 1600)
let step = CommandLine.arguments.count > 3 ? Double(CommandLine.arguments[3])! : 2.0
var manifest: [[String: Any]] = []
var t = 0.0
while t < duration {
 do {
  let img = try gen.copyCGImage(at: CMTime(seconds:t, preferredTimescale:600), actualTime:nil)
  let rep = NSBitmapImageRep(cgImage:img)
  let name = String(format:"frame-%06.1f.jpg",t)
  try rep.representation(using:.jpeg, properties:[.compressionFactor:0.90])!.write(to:URL(fileURLWithPath: output).appendingPathComponent(name))
  manifest.append(["timeSeconds":t,"file":name,"width":img.width,"height":img.height])
 } catch { print("FRAME_ERROR \(t) \(error)") }
 t += step
}
let data = try JSONSerialization.data(withJSONObject:["durationSeconds":duration,"frames":manifest], options:.prettyPrinted)
try data.write(to:URL(fileURLWithPath:output).appendingPathComponent("manifest.json"))
print("EXTRACTED \(manifest.count)")
