# Local drag crate patch

This is `drag` 2.1.1 from CrabNebula (Apache-2.0 OR MIT), patched for Prisma's Windows file drag preview.

The Windows path now converts PNG pixels to a top-down 32-bit DIB with straight alpha before passing it to `IDragSourceHelper::InitializeFromBitmap`. The upstream path used a device-dependent bitmap and premultiplied pixels. It also centers the drag image on the pointer and reports preview setup failures in development builds.

The crate API and drag/drop behavior are otherwise unchanged. Remove the `[patch.crates-io]` entry in Prisma's Cargo manifest when an upstream version contains an equivalent fix.
