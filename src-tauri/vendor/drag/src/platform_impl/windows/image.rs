// Copyright 2023-2023 CrabNebula Ltd.
// SPDX-License-Identifier: Apache-2.0
// SPDX-License-Identifier: MIT

use std::os::windows::ffi::OsStrExt;
use std::{ffi::c_void, iter::once, path::Path};
use windows::core::PCWSTR;
use windows::Win32::Foundation::*;
use windows::Win32::{
    Graphics::{
        Gdi::{CreateDIBSection, BITMAPINFO, BI_RGB, DIB_RGB_COLORS, HBITMAP},
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
        if pixel_format != GUID_WICPixelFormat32bppBGRA {
            let bitmap_source = WICConvertBitmapSource(&GUID_WICPixelFormat32bppBGRA, &frame)?;
            bitmap_source.CopyPixels(std::ptr::null(), width * 4, &mut pixel_buf)?;
        } else {
            frame.CopyPixels(std::ptr::null(), width * 4, &mut pixel_buf)?;
        }

        // InitializeFromBitmap applies alpha premultiplication itself. Keep the WIC
        // pixels straight and use a DIB section so Windows retains the alpha channel.
        let mut bitmap_info = BITMAPINFO::default();
        bitmap_info.bmiHeader.biSize = std::mem::size_of_val(&bitmap_info.bmiHeader) as u32;
        bitmap_info.bmiHeader.biWidth = width as i32;
        bitmap_info.bmiHeader.biHeight = -(height as i32); // top-down, matching WIC rows
        bitmap_info.bmiHeader.biPlanes = 1;
        bitmap_info.bmiHeader.biBitCount = 32;
        bitmap_info.bmiHeader.biCompression = BI_RGB.0;
        let mut bits: *mut c_void = std::ptr::null_mut();
        let bitmap = CreateDIBSection(None, &bitmap_info, DIB_RGB_COLORS, &mut bits, None, 0)?;
        std::ptr::copy_nonoverlapping(pixel_buf.as_ptr(), bits.cast(), pixel_buf.len());
        Ok(bitmap)
    }
}
