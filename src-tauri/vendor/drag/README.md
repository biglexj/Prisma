# Local drag crate patch

This is `drag` 2.1.1 from CrabNebula (Apache-2.0 OR MIT), patched for Prisma's Windows file drag preview.

The Windows path now converts PNG pixels to a top-down 32-bit DIB with straight alpha before passing it to `IDragSourceHelper::InitializeFromBitmap`. The upstream path used a device-dependent bitmap and premultiplied pixels. It also centers the drag image on the pointer and reports preview setup failures in development builds.

Before `DoDragDrop`, the Windows path also asks Windows 11 to promote an active primary pen/pointer contact to mouse input on the OLE thread. `ConvertPrimaryPointerToMouseDrag` is resolved dynamically from User32 ordinal 2811; unavailable APIs and an already promoted mouse contact retain the existing behavior. See [Microsoft's API documentation](https://learn.microsoft.com/en-us/windows/win32/winmsg/winuser/nf-winuser-convertprimarypointertomousedrag). Real tablet validation is still required.

The crate API is unchanged. Remove the `[patch.crates-io]` entry in Prisma's Cargo manifest when an upstream version contains equivalent fixes.
