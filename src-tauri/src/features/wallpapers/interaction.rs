//! Ratón del escritorio para efectos interactivos. No consume ni inyecta clics.
use std::{collections::VecDeque,sync::{LazyLock,Mutex}};
use super::compositor::CompositorConfig;

pub fn supported(config:&CompositorConfig)->bool {
    [(config.visibility.particles,&config.particle,"particles"),(config.visibility.scenario,&config.scenario,"scene")]
        .into_iter().any(|(visible,effect,prefix)|visible && ["bubbles","morphclick"].contains(&effect.as_str())
            && !config.controls.get(&format!("{prefix}:{effect}")).is_some_and(|controls|controls.paused))
}
#[derive(Default)]
struct InputState { target:isize, down:Option<[i32;2]>, clicks:VecDeque<[f32;2]> }
static INPUT:LazyLock<Mutex<InputState>>=LazyLock::new(||Mutex::new(InputState::default()));
const MAX_CLICKS:usize=32;

fn normalize(point:[i32;2],screen:super::window::ScreenGeometry)->[f32;2] {
    [(((point[0]-screen.x) as f32/screen.width.max(1) as f32)*2.0-1.0).clamp(-1.0,1.0),
     (1.0-((point[1]-screen.y) as f32/screen.height.max(1) as f32)*2.0).clamp(-1.0,1.0)]
}
fn root_is_desktop(class:&str)->bool { matches!(class,"Progman"|"WorkerW") }
impl InputState {
    fn mouse(&mut self,point:[i32;2],down:bool,up:bool,desktop:bool,screen:super::window::ScreenGeometry) {
        if down { self.down=desktop.then_some(point); }
        if self.down.is_some_and(|p| (point[0]-p[0]).abs()>=6 || (point[1]-p[1]).abs()>=6) {self.down=None;}
        if up {
            if self.down.take().is_some() && desktop {
                if self.clicks.len()==MAX_CLICKS {self.clicks.pop_front();}
                self.clicks.push_back(normalize(point,screen));
            }
        }
    }
}
#[cfg(windows)]
fn register(target:isize,remove:bool)->Result<(),String> {
    use windows::Win32::{Foundation::HWND,UI::Input::{RegisterRawInputDevices,RAWINPUTDEVICE,RIDEV_INPUTSINK,RIDEV_REMOVE}};
    unsafe {RegisterRawInputDevices(&[RAWINPUTDEVICE{usUsagePage:1,usUsage:2,
        dwFlags:if remove {RIDEV_REMOVE}else{RIDEV_INPUTSINK},hwndTarget:HWND(if remove {std::ptr::null_mut()}else{target as *mut _})}],
        std::mem::size_of::<RAWINPUTDEVICE>() as u32)}.map_err(|e|e.to_string())
}
pub fn disable() {
    if let Ok(mut state)=INPUT.lock() {
        #[cfg(windows)] if state.target!=0 {let _=register(0,true);}
        *state=InputState::default();
    }
}
pub fn poll(target:isize,enabled:bool)->Result<Vec<[f32;2]>,String> {
    if !enabled || target==0 {disable();return Ok(vec![]);}
    let mut state=INPUT.lock().map_err(|e|e.to_string())?;
    if state.target!=target {
        #[cfg(windows)] register(target,false)?;
        *state=InputState{target,..Default::default()};
    }
    Ok(state.clicks.drain(..).collect())
}
#[cfg(windows)]
pub fn raw_input(hwnd:windows::Win32::Foundation::HWND,lparam:windows::Win32::Foundation::LPARAM) {
    use windows::Win32::{Foundation::POINT,UI::{Input::{GetRawInputData,HRAWINPUT,RAWINPUT,RAWINPUTHEADER,RID_INPUT,RIM_TYPEMOUSE},WindowsAndMessaging::{
        GetCursorPos,WindowFromPoint,GetAncestor,GA_ROOT,GetClassNameW,GetShellWindow,GetWindowThreadProcessId,RI_MOUSE_LEFT_BUTTON_DOWN,RI_MOUSE_LEFT_BUTTON_UP,
    }}};
    let mut state=match INPUT.lock(){Ok(state)if state.target==hwnd.0 as isize=>state,_=>return};
    let mut raw=RAWINPUT::default();let mut size=std::mem::size_of::<RAWINPUT>() as u32;
    unsafe {
        let result=GetRawInputData(HRAWINPUT(lparam.0 as *mut _),RID_INPUT,Some(&mut raw as *mut _ as *mut _),&mut size,std::mem::size_of::<RAWINPUTHEADER>() as u32);
        if result==u32::MAX || raw.header.dwType!=RIM_TYPEMOUSE.0 {return;}
        // No consultar ventanas para cada movimiento si no hay gesto en curso.
        let buttons=raw.data.mouse.Anonymous.Anonymous.usButtonFlags as u32;
        let down=buttons & RI_MOUSE_LEFT_BUTTON_DOWN!=0;let up=buttons & RI_MOUSE_LEFT_BUTTON_UP!=0;
        if !down && !up && state.down.is_none(){return;}
        let mut point=POINT::default();if GetCursorPos(&mut point).is_err(){return;}
        let root=GetAncestor(WindowFromPoint(point),GA_ROOT);let mut class=[0u16;64];
        let len=GetClassNameW(root,&mut class);
        let mut root_pid=0;let mut shell_pid=0;
        GetWindowThreadProcessId(root,Some(&mut root_pid));GetWindowThreadProcessId(GetShellWindow(),Some(&mut shell_pid));
        let desktop=root_pid!=0 && root_pid==shell_pid && root_is_desktop(&String::from_utf16_lossy(&class[..len.max(0) as usize]));
        state.mouse([point.x,point.y],down,up,desktop,super::window::ScreenGeometry::current());
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    fn screen()->super::super::window::ScreenGeometry {super::super::window::ScreenGeometry{x:0,y:0,width:1920,height:1080}}
    #[test]
    fn clicks_are_bounded_and_ignore_apps_and_drags() {
        assert!(root_is_desktop("Progman"));assert!(root_is_desktop("WorkerW"));assert!(!root_is_desktop("CabinetWClass"));
        let mut state=InputState::default();
        state.mouse([960,540],true,false,false,screen());state.mouse([960,540],false,true,false,screen());assert!(state.clicks.is_empty());
        state.mouse([100,100],true,false,true,screen());state.mouse([120,100],false,true,true,screen());assert!(state.clicks.is_empty());
        for _ in 0..40 {state.mouse([960,540],true,false,true,screen());state.mouse([960,540],false,true,true,screen());}
        assert_eq!(state.clicks.len(),MAX_CLICKS);assert_eq!(state.clicks[0],[0.0,0.0]);
    }
    #[cfg(windows)]
    #[test]
    fn native_subscription_is_removed_when_disabled() {
        use windows::Win32::UI::Input::{GetRegisteredRawInputDevices,RAWINPUTDEVICE};
        let _guard=super::super::HOST_WINDOW_LOCK.lock().unwrap_or_else(|e|e.into_inner());
        let host=super::super::window::DesktopWallpaperWindow::create().unwrap();
        assert!(poll(host.host_handle(),true).unwrap().is_empty());
        let devices=|| unsafe {
            let mut count=0;GetRegisteredRawInputDevices(None,&mut count,std::mem::size_of::<RAWINPUTDEVICE>() as u32);
            let mut values=vec![RAWINPUTDEVICE::default();count as usize];
            if count>0 {assert_ne!(GetRegisteredRawInputDevices(Some(values.as_mut_ptr()),&mut count,std::mem::size_of::<RAWINPUTDEVICE>() as u32),u32::MAX);}
            values
        };
        assert!(devices().iter().any(|device|device.usUsage==2 && device.usUsagePage==1 && device.hwndTarget.0 as isize==host.host_handle()));
        disable();assert!(!devices().iter().any(|device|device.usUsage==2 && device.usUsagePage==1 && device.hwndTarget.0 as isize==host.host_handle()));
    }

    #[test]
    fn only_visible_interactive_effects_enable_mouse() {
        let mut config=CompositorConfig::default();assert!(!supported(&config));
        config.particle="bubbles".into();assert!(supported(&config));
        config.visibility.particles=false;assert!(!supported(&config));
        config.scenario="morphclick".into();assert!(supported(&config));
        let mut settings=super::super::composition_settings::LayerControls::default();settings.paused=true;
        config.controls.insert("scene:morphclick".into(),settings);assert!(!supported(&config));
    }
}
