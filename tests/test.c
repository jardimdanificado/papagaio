#include "../papagaio.h"


/* ============================================================
 * Demo com testes
 * ============================================================ */
int main(void)
{
    char *o;

    o = papagaio_process("((()))", "${(}{)}inner", "");
    printf("Test 1 - inner='%s'\n", o);
    free(o);

    o = papagaio_process("foo (a) (b) (c) bar",
                         "foo $${(}{)}xs bar",
                         "OK [$xs]");
    printf("Test 2 - %s\n", o);
    free(o);

    o = papagaio_process("hello:world", "$a:", "[$a]:");
    printf("Test 3 - %s\n", o);
    free(o);

    o = papagaio_process("start end", "start $opt? end", "[$opt]");
    printf("Test 4 - %s (esperado: [])\n", o);
    free(o);

    o = papagaio_process("start end", "start $${(}{)}blk? end", "[$blk]");
    printf("Test 5 - %s (esperado: [])\n", o);
    free(o);

    o = papagaio_process("start xyz end", "start $opt? end", "[$opt]");
    printf("Test 6 - %s (esperado: [xyz])\n", o);
    free(o);

    o = papagaio_process("a c", "$x? $y? $z?", "x=$x y=$y z=$z");
    printf("Test 7 - %s (esperado: x=a y=c z=)\n", o);
    free(o);

    o = papagaio_process("hello world", "$a $b", "$a=$b");
    printf("Test 8 - %s (esperado: hello=world)\n", o);
    free(o);

    o = papagaio_process("name:John age:30", "name:$name age:$age", "$name is $age");
    printf("Test 9 - %s (esperado: John is 30)\n", o);
    free(o);

    o = papagaio_process("prefix (content)", "$p $${(}{)}b", "$p+$b");
    printf("Test 10 - %s (esperado: prefix+content)\n", o);
    free(o);

    o = papagaio_process("one two three", "$a $b $c", "[$a][$b][$c]");
    printf("Test 11 - %s (esperado: [one][two][three])\n", o);
    free(o);

    o = papagaio_process("a c.x", " $x.", "[$x]");
    printf("Test 12 - %s (esperado: a[c]x)\n", o);
    free(o);

    o = papagaio_process("abc.def", "$x.", "[$x]");
    printf("Test 13 - %s (esperado: [abc]def)\n", o);
    free(o);

    o = papagaio_process("a  b  c", "$x $y $z", "[$x][$y][$z]");
    printf("Test 14 - %s (esperado: [a][b][c])\n", o);
    free(o);

    o = papagaio_process("hello world", " $x", "[$x]");
    printf("Test 15 - %s (esperado: hello[world])\n", o);
    free(o);

    o = papagaio_process("abc", " $x", "[$x]");
    printf("Test 16 - %s (esperado: abc - sem match)\n", o);
    free(o);

    printf("\n=== TESTE DETALHADO ===\n");
    o = papagaio_process("a c.c", " $x.", "x=$x");
    printf("Input:    \"a c.c\"\n");
    printf("Pattern:  \" $x.\"\n");
    printf("Replace:  \"x=$x\"\n");
    printf("Resultado: \"%s\"\n", o);
    printf("Esperado:  \"ax=cc\"\n");
    free(o);

    printf("\n=== TESTE REGRESSÃO ===\n");
    o = papagaio_process("a c", "$x? $y? $z?", "x=$x y=$y z=$z");
    printf("Input:    \"a c\"\n");
    printf("Pattern:  \"$x? $y? $z?\"\n");
    printf("Resultado: \"%s\"\n", o);
    printf("Esperado:  \"x=a y=c z=\"\n");
    free(o);

    return 0;
}