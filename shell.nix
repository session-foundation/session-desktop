{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {

  name = "session-desktop";
  packages = with pkgs; [
    nodejs_20
    nodeenv
    python314
    cmake
    gnumake
    nodeenv
        (pkgs.yarn.override {
          nodejs = null;
        })
  ];

  env = {
  };

  shellHook = ''
  '';

  LD_LIBRARY_PATH = with pkgs; pkgs.lib.makeLibraryPath [ nss nspr dbus cups gtk3 libxcomposite libgbm expat libxkbcommon alsa-lib ];

}
