//! Scoped COM initialization for helpers called from either the UI STA or worker threads.
use std::{marker::PhantomData, rc::Rc};
use windows::Win32::{
    Foundation::RPC_E_CHANGED_MODE,
    System::Com::{CoInitializeEx, CoUninitialize, COINIT_MULTITHREADED},
};

pub struct ComApartment {
    owned: bool,
    // Initialization and teardown must happen on the same thread.
    _thread: PhantomData<Rc<()>>,
}

impl ComApartment {
    pub fn multithreaded() -> windows::core::Result<Self> {
        let result = unsafe { CoInitializeEx(None, COINIT_MULTITHREADED) };
        let owned = if result.is_ok() {
            true // Both S_OK and S_FALSE require a matching CoUninitialize.
        } else if result == RPC_E_CHANGED_MODE {
            false // Reuse the existing STA; do not tear down the UI's OLE apartment.
        } else {
            return Err(result.into());
        };
        Ok(Self {
            owned,
            _thread: PhantomData,
        })
    }
}

impl Drop for ComApartment {
    fn drop(&mut self) {
        if self.owned {
            unsafe { CoUninitialize() };
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use windows::Win32::System::{
        Com::{
            CoGetApartmentType, APTTYPE, APTTYPEQUALIFIER, APTTYPE_MAINSTA, APTTYPE_MTA,
            APTTYPE_STA,
        },
        Ole::{OleInitialize, OleUninitialize},
    };

    fn apartment() -> Option<APTTYPE> {
        let mut kind = APTTYPE::default();
        let mut qualifier = APTTYPEQUALIFIER::default();
        unsafe {
            CoGetApartmentType(&mut kind, &mut qualifier).ok()?;
        }
        Some(kind)
    }

    #[test]
    fn audio_helper_preserves_an_existing_ole_apartment() {
        std::thread::spawn(|| unsafe {
            OleInitialize(None).unwrap();
            for _ in 0..20 {
                let com = ComApartment::multithreaded().unwrap();
                assert!(!com.owned);
                drop(com);
                assert!(matches!(apartment(), Some(APTTYPE_STA | APTTYPE_MAINSTA)));
                // Drag and drop can still initialize on this exact thread.
                OleInitialize(None).unwrap();
                OleUninitialize();
            }
            OleUninitialize();
            assert!(apartment().is_none());
        })
        .join()
        .unwrap();
    }

    #[test]
    fn audio_helper_balances_nested_initialization_and_early_return() {
        std::thread::spawn(|| {
            assert!(apartment().is_none());
            let outer = ComApartment::multithreaded().unwrap();
            assert_eq!(apartment(), Some(APTTYPE_MTA));
            {
                let _nested = ComApartment::multithreaded().unwrap();
                assert_eq!(apartment(), Some(APTTYPE_MTA));
            }
            assert_eq!(apartment(), Some(APTTYPE_MTA));
            drop(outer);
            assert!(apartment().is_none());
            let early = || -> Result<(), ()> {
                let _com = ComApartment::multithreaded().unwrap();
                Err(())?
            };
            assert!(early().is_err());
            assert!(apartment().is_none());
        })
        .join()
        .unwrap();
    }
}
