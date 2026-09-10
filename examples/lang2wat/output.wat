(module
  (import "env" "print_int" (func $print_int (param i32)))
  (import "env" "print_str" (func $print_str (param i32)))

  (memory (export "memory") 1)

  (global $g_counter (mut i32) (i32.const 500))

  (data (i32.const 1024) "Ola Mundo do WebAssembly com Macros Papagaio!\00")

  (func $test_macro_system (export "test_macro_system") (param $a i32) (param $b i32) (result i32)
    (local $menor i32)
    (local $_tmp i32)
    (local $acumulador i32)
    (local $_i i32)
    (local.set $menor (select (local.get $a) (local.get $b) (i32.lt_s (local.get $a) (local.get $b))))
    (local.set $_tmp (local.get $a))
    (local.set $a (local.get $b))
    (local.set $b (local.get $_tmp))
    (local.set $acumulador (i32.const 0))
    (local.set $_i (i32.const 0))
    (block $break_1
      (loop $continue_1
        (br_if $break_1 (i32.eqz (i32.lt_s (local.get $_i) (i32.const 4))))
        (local.set $acumulador (i32.add (local.get $acumulador) (local.get $a)))
    (local.set $_i (i32.add (local.get $_i) (i32.const 1)))
        (br $continue_1)
      )
    )
    (return (i32.add (local.get $acumulador) (local.get $menor)))
    (unreachable)
  )

  (func $test_direct_memory (export "test_direct_memory") (result i32)
    (local $valInt i32)
    (local $valByte i32)
    (local $valStore i32)
    (i32.store (i32.const 100) (i32.const 4000))
    (i32.store8 (i32.const 200) (i32.const 200))
    (i32.store (i32.const 300) (i32.const 42))
    (local.set $valInt (i32.load (i32.const 100)))
    (local.set $valByte (i32.load8_u (i32.const 200)))
    (local.set $valStore (i32.load (i32.const 300)))
    (return (i32.add (i32.add (local.get $valInt) (local.get $valByte)) (local.get $valStore)))
    (unreachable)
  )

  (func $score_grade (export "score_grade") (param $score i32) (result i32)
    (if
      (i32.ge_s (local.get $score) (i32.const 90))
      (then
        (return (i32.const 1))
      )
      (else
        (if
          (i32.ge_s (local.get $score) (i32.const 80))
          (then
            (return (i32.const 2))
          )
      (else
        (if
          (i32.ge_s (local.get $score) (i32.const 70))
          (then
            (return (i32.const 3))
          )
          (else
            (return (i32.const 4))
          )
        )
      )
        )
      )
    )
    (unreachable)
  )

  (func $greet (export "greet")
    (call $print_str (i32.const 1024))
  )

  (func $increment_global (export "increment_global") (param $amount i32) (result i32)
    (global.set $g_counter (i32.add (global.get $g_counter) (local.get $amount)))
    (return (global.get $g_counter))
    (unreachable)
  )

  (func $bit_and_byte_ops (export "bit_and_byte_ops") (param $val i32) (result i32)
    (local $bits i32)
    (local $byteVal i32)
    (local.set $bits (i32.popcnt (local.get $val)))
    (i32.store8 (i32.const 200) (i32.const 255))
    (local.set $byteVal (i32.load8_u (i32.const 200)))
    (return (i32.add (local.get $bits) (local.get $byteVal)))
    (unreachable)
  )

  (func $fib (export "fib") (param $n i32) (result i32)
    (if
      (i32.le_s (local.get $n) (i32.const 1))
      (then
        (return (local.get $n))
      )
    )
    (return (i32.add (call $fib (i32.sub (local.get $n) (i32.const 1))) (call $fib (i32.sub (local.get $n) (i32.const 2)))))
    (unreachable)
  )
)