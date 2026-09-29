// Copyright 2023-2023 CrabNebula Ltd.
// SPDX-License-Identifier: Apache-2.0
// SPDX-License-Identifier: MIT

use std::os::windows::ffi::OsStrExt;
use std::{ffi::c_void, iter::once, path::Path};
use windows::core::PCWSTR;
use windows::Win32::Foundation::*;
use windows::Win32::{
    Graphics::{
        Gdi::{CreateDIBSection, BITMAPINFO, BITMAPINFOHEADER, BI_RGB, DIB_RGB_COLORS, HBITMAP, HDC},
        Imaging::{
            CLSID_WICImagingFactory, GUID_WICPixelFormat32bppBGRA, IWICBitmapDecoder,
            IWICImagingFactory, WICConvertBitmapSource, WICDecodeMetadataCacheOnDemand,
        },
    },
    System::Com::{CoCreateInstance, CLSCTX_INPROC_SERVER},
};

use crate::Result;

pub(crate) fn read_bytes_to_hbitmap(bytes: &[u8]) -> Result<HBITMAP> {
    unsafe {
        let factory: IWICImagingFactory =
            CoCreateInstance(&CLSID_WICImagingFactory, None, CLSCTX_INPROC_SERVER)?;

        let stream = factory.CreateStream()?;
        stream.InitializeFromMemory(bytes)?;

        let decoder = factory.CreateDecoderFromStream(
            &stream,
            std::ptr::null(),
            WICDecodeMetadataCacheOnDemand,
        )?;

        decoder_to_hbitmap(decoder)
    }
}

pub(crate) fn read_path_to_hbitmap(path: &Path) -> Result<HBITMAP> {
    unsafe {
        let factory: IWICImagingFactory =
            CoCreateInstance(&CLSID_WICImagingFactory, None, CLSCTX_INPROC_SERVER)?;

        let path = dunce::canonicalize(path)?;
        let wide_path: Vec<u16> = path.as_os_str().encode_wide().chain(once(0)).collect();

        let decoder = factory.CreateDecoderFromFilename(
            PCWSTR::from_raw(wide_path.as_ptr()),
            None,
            GENERIC_READ,
            WICDecodeMetadataCacheOnDemand,
        )?;

        decoder_to_hbitmap(decoder)
    }
}

fn decoder_to_hbitmap(decoder: IWICBitmapDecoder) -> Result<HBITMAP> {
    unsafe {
        let frame = decoder.GetFrame(0)?;

        let mut width: u32 = 0;
        let mut height: u32 = 0;
        frame.GetSize(&mut width, &mut height)?;

        let mut pixel_buf: Vec<u8> = vec![0; (width * height * 4) as usize];
        let pixel_format = frame.GetPixelFormat()?;
        // IDragSourceHelper multiplies RGB by alpha itself. Passing PBGRA would multiply twice.
        if pixel_format != GUID_WICPixelFormat32bppBGRA {
            let bitmap_source = WICConvertBitmapSource(&GUID_WICPixelFormat32bppBGRA, &frame)?;
            bitmap_source.CopyPixels(std::ptr::null(), width * 4, &mut pixel_buf)?;
        } else {
            frame.CopyPixels(std::ptr::null(), width * 4, &mut pixel_buf)?;
        }

        pixels_to_hbitmap(width, height, &pixel_buf)
    }
}

fn pixels_to_hbitmap(width: u32, height: u32, pixels: &[u8]) -> Result<HBITMAP> {
    let info = BITMAPINFO {
        bmiHeader: BITMAPINFOHEADER {
            biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
            biWidth: width as i32,
            biHeight: -(height as i32), // WIC supplies rows from top to bottom.
            biPlanes: 1,
            biBitCount: 32,
            biCompression: BI_RGB.0,
            ..Default::default()
        },
        ..Default::default()
    };
    let mut bits: *mut c_void = std::ptr::null_mut();
    unsafe {
        let bitmap = CreateDIBSection(HDC::default(), &info, DIB_RGB_COLORS, &mut bits, HANDLE::default(), 0)?;
        std::ptr::copy_nonoverlapping(pixels.as_ptr(), bits.cast::<u8>(), pixels.len());
        Ok(bitmap)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use windows::Win32::Graphics::Gdi::{DeleteObject, GetObjectW, DIBSECTION};

    #[test]
    fn native_bitmap_keeps_color_alpha_and_top_down_rows() {
        // Two rows with opaque, translucent and transparent pixels, in unpremultiplied BGRA.
        let pixels = [10, 20, 200, 255, 40, 80, 160, 128, 0, 0, 0, 0, 90, 30, 10, 255];
        let bitmap = pixels_to_hbitmap(2, 2, &pixels).unwrap();
        unsafe {
            let mut dib = DIBSECTION::default();
            assert_eq!(GetObjectW(bitmap, std::mem::size_of::<DIBSECTION>() as i32, Some((&mut dib as *mut DIBSECTION).cast())), std::mem::size_of::<DIBSECTION>() as i32);
            assert_eq!(dib.dsBm.bmBitsPixel, 32);
            assert_eq!(dib.dsBmih.biHeight.abs(), 2);
            assert_eq!(std::slice::from_raw_parts(dib.dsBm.bmBits.cast::<u8>(), pixels.len()), pixels);
            DeleteObject(bitmap).ok().unwrap();
        }
    }
}
