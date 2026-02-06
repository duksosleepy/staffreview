CREATE MIGRATION m1uqkejbqn6kq6wpkthgnwz75jezexp3ruxyrmgc3k2l3ob2yv4kpa
    ONTO m1e46ufmebw6lon4jrje5xvdounawtwwysm7pczbzb6iykecnufg3a
{
  CREATE SCALAR TYPE default::ShiftType EXTENDING enum<S, C, F>;
};
